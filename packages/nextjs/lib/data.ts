import { unstable_cache } from "next/cache";
import { dateKey, fillDays, getRange, InputError, rankSearchUsers, summarize, validFid } from "./activity";
import type { Activity, Profile, SearchProfile } from "./activity";
import { query } from "./clickhouse";

const profileByFid = unstable_cache(
  async (fid: string): Promise<Profile> => {
    const rows = await query<Profile>(
      "SELECT toString(p.fid) AS fid, username, display_name FROM farcaster.profiles AS p WHERE p.fid = {fid:UInt64} LIMIT 1",
      { fid },
    );
    return rows[0] || { fid, username: null, display_name: null };
  },
  ["profile-v1"],
  { revalidate: 300 },
);
const resolveUsername = unstable_cache(
  async (username: string) => {
    const rows = await query<{ fid: string }>(
      "SELECT DISTINCT toString(u.fid) AS fid FROM farcaster.usernames AS u WHERE username = {username:String} AND u.fid > 0 LIMIT 2",
      { username },
    );
    if (rows.length > 1) throw new InputError("This username has multiple proofs. Please use the FID instead.", 409);
    if (!rows[0]) throw new InputError("Username not found in the captured data. Try their numeric FID.", 404);
    return rows[0].fid;
  },
  ["username-v1"],
  { revalidate: 300 },
);
const dailyActivity = unstable_cache(
  async (fid: string, today: string) => {
    const rows = await query<{ day: string; actions: string | number }>(
      `SELECT toDate(timestamp, 'UTC') AS day, count() AS actions
FROM farcaster.activities
WHERE fid = {fid:UInt64} AND timestamp >= toDateTime('2021-01-01', 'UTC')
  AND timestamp < toDateTime({today:Date}, 'UTC') + INTERVAL 1 DAY
GROUP BY day ORDER BY day`,
      { fid, today },
    );
    return {
      rows: rows.map((row) => ({ day: row.day, actions: Number(row.actions) })),
      updatedAt: new Date().toISOString(),
    };
  },
  ["daily-v1"],
  { revalidate: 300 },
);
const datasetStatus = unstable_cache(
  async () => {
    const rows = await query<{ current_state_is_ready: number | null; coverage: string }>(
      "SELECT current_state_is_ready, coverage FROM farcaster.dataset_status LIMIT 1",
    );
    return rows[0] || { current_state_is_ready: null, coverage: "Historical coverage is incomplete." };
  },
  ["coverage-v1"],
  { revalidate: 60 },
);

export async function loadActivity(input: string, period = "365", anchor?: string): Promise<Activity> {
  const range = getRange(period, anchor);
  const lookup = input.trim().replace(/^@/, "").toLowerCase();
  if (!lookup || lookup.length > 64) throw new InputError("Enter a Farcaster username or numeric FID.");
  const numeric = /^\d+$/.test(lookup);
  if (numeric && !validFid(lookup)) throw new InputError("Enter a valid positive FID.");
  if (!numeric && !/^[a-z0-9][a-z0-9.-]{0,62}$/.test(lookup))
    throw new InputError("Enter a valid Farcaster username, without a profile URL.");
  const fid = numeric ? lookup : await resolveUsername(lookup);
  const today = dateKey(new Date());
  const [profile, history, status] = await Promise.all([profileByFid(fid), dailyActivity(fid, today), datasetStatus()]);
  const days = fillDays(history.rows, range.start, range.end, range.anchor);
  const currentYear = Number(today.slice(0, 4));
  const firstYear = Number(history.rows[0]?.day.slice(0, 4) || currentYear);
  return {
    profile,
    period,
    ...range,
    days,
    years: Array.from({ length: currentYear - firstYear + 1 }, (_, index) => currentYear - index),
    ...summarize(days),
    updatedAt: history.updatedAt,
    catchingUp: status.current_state_is_ready !== 1,
    coverage: status.coverage,
  };
}

const farcasterSuggestions = unstable_cache(
  async (prefix: string): Promise<SearchProfile[]> => {
    const numeric = /^\d+$/.test(prefix);
    async function fetchUsers(path: string, parameters: Record<string, string>) {
      const url = new URL(`https://client.farcaster.xyz/v2/${path}`);
      url.search = new URLSearchParams(parameters).toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
      if (path === "user-by-fid" && (response.status === 404 || response.status === 400)) return {};
      if (!response.ok) throw new Error("Farcaster search is temporarily unavailable.");
      const body = await response.json();
      if (!body.result) throw new Error("Farcaster search returned an unreadable response.");
      return body.result as { users?: unknown[]; user?: unknown };
    }
    const [search, exact] = await Promise.allSettled([
      fetchUsers("search-summary", { q: prefix, maxChannels: "0", maxUsers: "25" }),
      numeric ? fetchUsers("user-by-fid", { fid: prefix }) : Promise.resolve({}),
    ]);
    if (search.status === "rejected" && (!numeric || exact.status === "rejected"))
      throw new Error("Farcaster search is temporarily unavailable.");
    const users: unknown[] =
      search.status === "fulfilled" && Array.isArray(search.value.users) ? search.value.users : [];
    const exactUser = exact.status === "fulfilled" && "user" in exact.value ? exact.value.user : undefined;
    if (exactUser) users.unshift(exactUser);
    else if (numeric) {
      const profile = await profileByFid(prefix);
      users.unshift({ fid: prefix, username: profile.username, displayName: profile.display_name });
    }
    return rankSearchUsers(users, numeric ? prefix : undefined);
  },
  ["farcaster-suggestions-followers-v2"],
  { revalidate: 60 },
);

export async function searchAccounts(input: string): Promise<SearchProfile[]> {
  const prefix = input.trim().replace(/^@/, "").toLowerCase();
  if (!prefix) return [];
  if (/^\d+$/.test(prefix)) {
    if (!validFid(prefix)) throw new InputError("Enter a valid positive FID.");
    return farcasterSuggestions(prefix);
  }
  if (prefix.length > 63 || !/^[a-z0-9][a-z0-9.-]*$/.test(prefix))
    throw new InputError("Enter a valid username or FID.");
  if (prefix.length < 2) return [];
  return farcasterSuggestions(prefix);
}

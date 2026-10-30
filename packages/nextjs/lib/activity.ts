export const PURPLES = ["#211b2e", "#3f2a61", "#624090", "#855dcd", "#b596f2"];
const DAY = 86_400_000;
export type Day = { date: string; actions: number; future: boolean };
export type Profile = { fid: string; username: string | null; display_name: string | null; pfp_url?: string | null };
export type Activity = {
  profile: Profile;
  period: string;
  anchor: string;
  start: string;
  end: string;
  days: Day[];
  years: number[];
  total: number;
  activeDays: number;
  longestStreak: number;
  peak: number;
  peakDate: string | null;
  updatedAt: string;
  catchingUp: boolean;
  coverage: string;
};
export class InputError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function validFid(value: string) {
  return /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 18_446_744_073_709_551_615n;
}
export function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
export function utcDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}
export function getRange(period = "365", anchor = dateKey(new Date())) {
  const today = dateKey(new Date());
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(anchor) ||
    !Number.isFinite(utcDate(anchor).getTime()) ||
    dateKey(utcDate(anchor)) !== anchor ||
    anchor > today ||
    anchor < "2021-01-01"
  ) {
    throw new InputError("Choose a valid date between 2021 and today.");
  }
  if (period === "365") return { start: dateKey(new Date(utcDate(anchor).getTime() - 364 * DAY)), end: anchor, anchor };
  const year = Number(period);
  if (!/^\d{4}$/.test(period) || year < 2021 || year > Number(today.slice(0, 4)))
    throw new InputError("Choose a year between 2021 and this year.");
  return { start: `${year}-01-01`, end: `${year}-12-31`, anchor };
}
export function fillDays(rows: { day: string; actions: number }[], start: string, end: string, today: string) {
  const counts = new Map(rows.map((row) => [row.day, row.actions]));
  const days: Day[] = [];
  for (let stamp = utcDate(start).getTime(); stamp <= utcDate(end).getTime(); stamp += DAY) {
    const date = dateKey(new Date(stamp));
    days.push({ date, actions: date > today ? 0 : counts.get(date) || 0, future: date > today });
  }
  return days;
}
export function summarize(days: Day[]) {
  let total = 0,
    activeDays = 0,
    longestStreak = 0,
    streak = 0,
    peak = 0;
  let peakDate: string | null = null;
  for (const day of days) {
    if (day.future) continue;
    total += day.actions;
    if (day.actions > peak) {
      peak = day.actions;
      peakDate = day.date;
    }
    if (day.actions > 0) {
      activeDays++;
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else streak = 0;
  }
  return { total, activeDays, longestStreak, peak, peakDate };
}
export function colorLevel(actions: number, peak: number) {
  if (!actions || !peak) return 0;
  return Math.min(4, Math.max(1, Math.ceil((Math.log1p(actions) / Math.log1p(peak)) * 4)));
}
export function grid(days: Day[]) {
  const offset = utcDate(days[0].date).getUTCDay();
  return {
    offset,
    columns: Math.ceil((offset + days.length) / 7),
    cells: days.map((day, index) => ({ ...day, column: Math.floor((offset + index) / 7), row: (offset + index) % 7 })),
  };
}
export function periodLabel(period: string) {
  return period === "365" ? "the past 365 days" : period;
}
export function sharePath(fid: string, period: string, anchor: string, timestamp?: string, compare?: string) {
  const params = new URLSearchParams({ period, end: anchor });
  if (timestamp) params.set("ts", timestamp);
  if (compare) params.set("compare", compare);
  return `/share/${fid}?${params}`;
}

export type SearchProfile = Profile & { followerCount: number | null; pfp_url: string | null };
export function rankSearchUsers(users: unknown[], exactFid?: string): SearchProfile[] {
  const unique = new Map<string, SearchProfile>();
  for (const value of users) {
    if (!value || typeof value !== "object") continue;
    const user = value as Record<string, unknown>;
    if (typeof user.fid !== "string" && (typeof user.fid !== "number" || !Number.isSafeInteger(user.fid))) continue;
    const fid = String(user.fid);
    if (!validFid(fid) || unique.has(fid)) continue;
    const pfp = (user.pfp as { url?: unknown } | undefined)?.url;
    unique.set(fid, {
      fid,
      username: typeof user.username === "string" ? user.username : null,
      display_name: typeof user.displayName === "string" ? user.displayName : null,
      pfp_url: typeof pfp === "string" && /^https?:\/\//i.test(pfp) ? pfp : null,
      followerCount:
        typeof user.followerCount === "number" && Number.isSafeInteger(user.followerCount) && user.followerCount >= 0
          ? user.followerCount
          : null,
    });
  }
  return [...unique.values()]
    .sort(
      (a, b) =>
        Number(b.fid === exactFid) - Number(a.fid === exactFid) ||
        (b.followerCount ?? -1) - (a.followerCount ?? -1) ||
        (a.username || a.fid).localeCompare(b.username || b.fid),
    )
    .slice(0, 8);
}

export function activityDate(date: string | null) {
  return date
    ? utcDate(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "—";
}

export function activityShareText(activity: Pick<Activity, "profile" | "total" | "period">, viewerFid?: string) {
  const name = activity.profile.username ? `@${activity.profile.username}` : `FID ${activity.profile.fid}`;
  const subject = viewerFid === activity.profile.fid ? "I have" : `${name} has`;
  return `${subject} ${activity.total.toLocaleString("en-US")} captured Farcaster actions in ${periodLabel(activity.period)}. A year, one square at a time.\n\nHow about you?`;
}

export const BLUES = ["#192231", "#243c5c", "#365f91", "#528bd0", "#8bbdff"];
export function accountName(activity: Pick<Activity, "profile">) {
  return activity.profile.username ? `@${activity.profile.username}` : `FID ${activity.profile.fid}`;
}
export function comparisonPeak(first: Pick<Activity, "peak">, second: Pick<Activity, "peak">) {
  return Math.max(first.peak, second.peak);
}
export function comparisonStats(first: Activity, second: Activity) {
  return [
    { key: "activeDays", label: "Active days", unit: "days", first: first.activeDays, second: second.activeDays },
    {
      key: "longestStreak",
      label: "Longest streak",
      unit: "days",
      first: first.longestStreak,
      second: second.longestStreak,
    },
    {
      key: "peak",
      label: "Busiest day",
      unit: "actions",
      first: first.peak,
      second: second.peak,
      firstDate: first.peakDate,
      secondDate: second.peakDate,
    },
  ].map((stat) => ({
    ...stat,
    winner: stat.first === stat.second ? "tie" : stat.first > stat.second ? "first" : "second",
  }));
}
export function comparisonShareText(first: Activity, second: Activity) {
  return `${accountName(first)} vs ${accountName(second)}: ${first.total.toLocaleString("en-US")} vs ${second.total.toLocaleString("en-US")} captured Farcaster actions in ${periodLabel(first.period)}. A year, one square at a time.\n\nHow about you?`;
}

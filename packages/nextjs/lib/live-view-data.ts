import "server-only";
import { unstable_cache } from "next/cache";
import { query } from "~~/lib/clickhouse";
import { resolveAccount } from "~~/lib/data";
import { loadProfiles } from "~~/lib/profile-data";
import { dateKey, type Profile } from "~~/lib/activity";
import { liveEventsQuery, type LiveCounts, type LiveData, type LiveType } from "~~/lib/live-view";

const zero = (): LiveCounts => ({ casts: 0, replies: 0, recasts: 0, likes: 0, mentions: 0, dau: 0 });
const readTotals = unstable_cache(
  async (user: string, date: string) => {
    const table = user ? "action_messages_by_fid" : "action_messages";
    const actor = user ? "PREWHERE fid = {user:UInt64}" : "";
    const window =
      "timestamp >= toDateTime({date:Date}, 'UTC') - INTERVAL 1 DAY AND timestamp <= toDateTime({asOf:UInt32}, 'UTC')";
    const keys = `SELECT fid,substring(hash,3) FROM snapchain.${table} ${actor} WHERE ${window} AND action_type IN ('cast','reply')`;
    const params = {
      date,
      user: user || "0",
      asOf: String(Math.min(Math.floor(Date.now() / 1000), Date.parse(date + "T23:59:59Z") / 1000)),
    };
    const [actions, mentions] = await Promise.all([
      query<{ day: string; casts: number; replies: number; recasts: number; likes: number; dau: number }>(
        `SELECT toDate(timestamp,'UTC') AS day,countIf(action_type='cast') AS casts,
       countIf(action_type='reply') AS replies,countIf(action_type='recast') AS recasts,countIf(action_type='like') AS likes,uniqExactIf(fid,fid>0) AS dau
       FROM snapchain.${table} FINAL ${actor} WHERE ${window} GROUP BY day`,
        params,
        { timeoutMs: 12000 },
      ),
      query<{ day: string; mentions: number }>(
        `SELECT toDate(fromUnixTimestamp64Second(toInt64(timestamp)+1609459200,'UTC')) AS day,
       sum(length(arrayDistinct(arrayFilter(target -> target>0 AND target!=fid,mentions)))) AS mentions
       FROM snapchain.mention_messages FINAL PREWHERE (fid,hash) IN (${keys})
       WHERE operation IN ('merge','prune') AND (fid,hash) NOT IN (
         SELECT fid,target_hash FROM snapchain.cast_removals FINAL PREWHERE (fid,target_hash) IN (${keys}) WHERE operation='merge'
       ) GROUP BY day SETTINGS optimize_move_to_prewhere_if_final=0`,
        params,
        { timeoutMs: 12000 },
      ),
    ]);
    const counts: Record<string, LiveCounts> = {};
    for (const row of actions)
      counts[row.day] = {
        ...zero(),
        casts: Number(row.casts),
        replies: Number(row.replies),
        recasts: Number(row.recasts),
        likes: Number(row.likes),
        dau: Number(row.dau),
      };
    for (const row of mentions) counts[row.day] = { ...(counts[row.day] ?? zero()), mentions: Number(row.mentions) };
    const yesterday = dateKey(new Date(Date.parse(date + "T00:00:00Z") - 86400000));
    return {
      today: counts[date] ?? zero(),
      yesterday: counts[yesterday] ?? zero(),
      asOf: new Date(Number(params.asOf) * 1000).toISOString(),
    };
  },
  ["live-view-totals-v2"],
  { revalidate: 5 },
);
const readSource = unstable_cache(
  async () => {
    const [row] = await query<{ checked_at: string; current_state_is_ready: number | null; coverage: string }>(
      "SELECT checked_at,current_state_is_ready,coverage FROM farcaster.dataset_status LIMIT 1",
      {},
      { timeoutMs: 4000 },
    );
    return {
      checkedAt: row?.checked_at ?? null,
      catchingUp: row?.current_state_is_ready !== 1,
      coverage: row?.coverage || "Captured history is incomplete.",
    };
  },
  ["live-view-source-v1"],
  { revalidate: 10 },
);

export async function loadLiveView(selection: { user?: string; type: LiveType; after?: string }): Promise<LiveData> {
  const user = selection.user ? await resolveAccount(selection.user) : undefined;
  const date = dateKey(new Date());
  const { sql, params } = liveEventsQuery(user, selection.type, selection.after);
  const [raw, totals, source] = await Promise.all([
    query<{
      ts: number;
      hash: string;
      actor: string;
      action_type: "cast" | "reply" | "like" | "recast";
      body: string;
      parent: string | null;
      target: string | null;
      parent_hash: string | null;
      target_hash: string | null;
    }>(sql, params, { timeoutMs: 12000 }),
    readTotals(user || "", date),
    readSource(),
  ]);
  const candidates = [...new Map(raw.slice(0, 60).map((row) => [row.hash, row])).values()];
  const posts = candidates.filter((row) => row.action_type === "cast" || row.action_type === "reply");
  const tags = posts.length
    ? await query<{ actor: string; hash: string; mentions: string[] }>(
        `SELECT toString(fid) AS actor,hash,arrayMap(target -> toString(target),arrayDistinct(arrayFilter(target -> target>0 AND target!=fid,mentions))) AS mentions
     FROM snapchain.messages FINAL PREWHERE (fid,type,hash) IN {posts:Array(Tuple(UInt64,UInt16,String))} WHERE operation IN ('merge','prune') SETTINGS optimize_move_to_prewhere_if_final=0`,
        { posts: `[${posts.map((row) => `(${row.actor},1,'${row.hash.slice(2)}')`).join(",")}]` },
        { timeoutMs: 8000 },
      )
    : [];
  const tagged = candidates.map((row) => ({
    ...row,
    mentions: tags.find((tag) => tag.hash === row.hash.slice(2) && tag.actor === row.actor)?.mentions ?? [],
  }));
  const matching = tagged.filter((row) => selection.type !== "mention" || row.mentions.length > 0);
  const page = matching.slice(0, 20);
  const consumed = matching.length > 20 ? page.at(-1) : tagged.at(-1);
  const fids = [
    ...new Set([
      ...(user ? [user] : []),
      ...page
        .flatMap((row) => [row.actor, row.parent, row.target, ...row.mentions.slice(0, 5)])
        .filter((fid): fid is string => !!fid && fid !== "0"),
    ]),
  ];
  const profiles = await loadProfiles(fids, 3000).catch(() => []);
  const profile = (fid: string): Profile =>
    profiles.find((profile) => profile.fid === fid) ?? { fid, username: null, display_name: null };
  const events = page.map((row) => ({
    id: `${row.hash}:${selection.type === "mention" ? "mention" : row.action_type}`,
    cursor: `${row.ts}:${row.hash}`,
    timestamp: new Date(Number(row.ts) * 1000).toISOString(),
    action: selection.type === "mention" ? ("mention" as const) : row.action_type,
    actor: profile(row.actor),
    target:
      row.parent && row.parent !== "0"
        ? profile(row.parent)
        : row.target && row.target !== "0"
          ? profile(row.target)
          : null,
    text: row.body,
    castHash: row.target_hash || row.parent_hash || row.hash,
    mentions: row.mentions.slice(0, 5).map(profile),
    mentionCount: row.mentions.length,
  }));
  if (selection.after) events.reverse();
  return {
    events,
    totals,
    source,
    date,
    profile: user ? profile(user) : null,
    now: new Date().toISOString(),
    headCursor: selection.after
      ? consumed
        ? `${consumed.ts}:${consumed.hash}`
        : selection.after
      : candidates[0]
        ? `${candidates[0].ts}:${candidates[0].hash}`
        : null,
    hasMore: raw.length > 60 || matching.length > 20,
  };
}

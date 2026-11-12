import "server-only";
import { unstable_cache } from "next/cache";
import { dateKey } from "~~/lib/activity";
import { query } from "~~/lib/clickhouse";
import { loadProfiles } from "~~/lib/profile-data";
import {
  casterMetrics,
  casterRange,
  casterRankingSql,
  type CasterSelection,
  type TopCasters,
} from "~~/lib/top-casters";

const readRanks = unstable_cache(
  async (start: string, through: string, user: string) => {
    return query<{
      metric: number;
      fid: string;
      score: string;
      position: string;
      user_position: string;
      generated_at: string;
    }>(casterRankingSql, { start, through, user });
  },
  ["top-casters-ranks-v4"],
  { revalidate: 300 },
);

const readStatus = unstable_cache(
  async () => {
    const [snapshot] = await query<{ updated_at: string }>(
      "SELECT toString(max(generated_at)) AS updated_at FROM farcaster.top_casters_daily",
    );
    if (!snapshot?.updated_at || snapshot.updated_at.startsWith("1970-"))
      throw new Error("Top Casters summary is not ready.");
    const [status] = await query<{ checked_at: string; current_state_is_ready: number | null; coverage: string }>(
      "SELECT checked_at, current_state_is_ready, coverage FROM farcaster.dataset_status LIMIT 1",
    );
    return {
      updatedAt: snapshot.updated_at,
      checkedAt: status?.checked_at ?? null,
      catchingUp: status?.current_state_is_ready !== 1,
      coverage: status?.coverage || "Historical coverage is incomplete.",
    };
  },
  ["top-casters-status-v2"],
  { revalidate: 60 },
);

export async function loadTopCasters(selection: CasterSelection): Promise<TopCasters> {
  const range = casterRange(selection);
  const status = await readStatus();
  const rows = await readRanks(range.start, range.through, selection.user || "0");
  const ids = [...new Set([...(selection.user ? [selection.user] : []), ...rows.map((row) => row.fid)])];
  const profiles = await loadProfiles(ids, 4000).catch(() => []);
  return {
    ...range,
    ...status,
    partialDay: range.through === dateKey(new Date()),
    updatedAt: rows[0]?.generated_at || status.updatedAt,
    profiles,
    lists: Object.keys(casterMetrics).map((metric, index) => {
      const ranked = rows.filter((row) => Number(row.metric) === index + 1);
      return {
        metric: metric as keyof typeof casterMetrics,
        userPosition: Number(ranked[0]?.user_position) || null,
        rows: ranked.map((row) => ({ fid: row.fid, score: Number(row.score), position: Number(row.position) })),
      };
    }),
  };
}

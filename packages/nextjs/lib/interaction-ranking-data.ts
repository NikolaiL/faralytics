import "server-only";
import { unstable_cache } from "next/cache";
import { query } from "~~/lib/clickhouse";
import {
  interactionRankingSql,
  type InteractionPeriod,
  type InteractionMetric,
  type InteractionRanking,
  type InteractionRank,
} from "~~/lib/interaction-ranking";
import { loadProfiles } from "~~/lib/profile-data";

export const readInteractionRanking = unstable_cache(
  async (fid: string): Promise<InteractionRanking> => {
    const rows = await query<InteractionRank & { period: InteractionPeriod; metric: InteractionMetric }>(
      interactionRankingSql,
      { fid },
      { timeoutMs: 30000 },
    );
    const rankings: InteractionRanking["rankings"] = {
      all: { sent: [], received: [], total: [], mutual: [] },
      days30: { sent: [], received: [], total: [], mutual: [] },
      days7: { sent: [], received: [], total: [], mutual: [] },
    };
    for (const { period, metric, ...row } of rows) rankings[period][metric].push(row);
    const ids = [...new Set([fid, ...rows.map((row) => row.fid)])];
    const profiles = await loadProfiles(ids, 4000).catch(() => []);
    return {
      profile: profiles.find((profile) => profile.fid === fid) || { fid, username: null, display_name: null },
      profiles,
      rankings,
    };
  },
  ["interaction-ranking-v3"],
  { revalidate: 300 },
);

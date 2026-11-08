import "server-only";
import { unstable_cache } from "next/cache";
import { query } from "~~/lib/clickhouse";
import { loadProfiles } from "~~/lib/profile-data";
import { farcasterEpoch, wordCloudSql, type WordCloudData, type WordCloudSelection } from "~~/lib/word-cloud";
import { wordCloudTokens } from "~~/lib/word-cloud-tokens";

export const readWordCloud = unstable_cache(
  async (fid: string, selection: WordCloudSelection): Promise<WordCloudData> => {
    const end = Number(selection.at) - farcasterEpoch;
    const start = selection.period === "all" ? 0 : Math.max(0, end - Number(selection.period) * 86400);
    const [rows, [profile]] = await Promise.all([
      query<{ term: string; occurrences: string | number }>(
        wordCloudSql,
        {
          ...wordCloudTokens,
          fid,
          start: String(start),
          end: String(end),
        },
        { timeoutMs: 10000 },
      ),
      loadProfiles([fid], 4000).catch(() => [{ fid, username: null, display_name: null }]),
    ]);
    return {
      ...selection,
      profile,
      casts: rows[0]?.term === "" ? Number(rows[0].occurrences) : 0,
      words: rows.filter((row) => row.term !== "").map((row) => [row.term, Number(row.occurrences)]),
    };
  },
  ["word-cloud-v1"],
  { revalidate: 300 },
);

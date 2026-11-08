import "server-only";
import { unstable_cache } from "next/cache";
import { query } from "~~/lib/clickhouse";
import { loadProfiles } from "~~/lib/profile-data";
import {
  farcasterEpoch,
  globalWordCloudSql,
  wordCloudActivitySql,
  wordCloudDaySeconds,
  wordCloudPeriodSeconds,
  wordCloudTimelineDays,
  wordCloudSql,
  type GlobalWordCloudData,
  type GlobalWordCloudSelection,
  type WordCloudData,
  type WordCloudFrame,
  type WordCloudSelection,
  type WordCloudTimelinePage,
} from "~~/lib/word-cloud";
import { wordCloudTokens } from "~~/lib/word-cloud-tokens";

export async function readWordCounts(fid: string | null, start: number, frames: number[]) {
  const rows = await query<{ frame: number; term: string; occurrences: string | number }>(
    fid ? wordCloudSql : globalWordCloudSql,
    {
      ...wordCloudTokens,
      ...(fid ? { fid } : {}),
      start: String(start),
      end: String(frames.at(-1)),
      frames: `[${frames.join(",")}]`,
    },
    { timeoutMs: 15000 },
  );
  const byTime = new Map<number, WordCloudFrame>(
    frames.map((frame) => [frame, { at: String(frame + farcasterEpoch), casts: 0, words: [] }]),
  );
  for (const { frame, term, occurrences } of rows) {
    const point = byTime.get(Number(frame));
    if (!point) continue;
    if (term === "") point.casts = Number(occurrences);
    else point.words.push([term, Number(occurrences)]);
  }
  return [...byTime.values()];
}

export const readWordCloud = unstable_cache(
  async (fid: string, selection: WordCloudSelection): Promise<WordCloudData> => {
    const end = Number(selection.at) - farcasterEpoch;
    const start = selection.period === "all" ? 0 : Math.max(0, end - Number(selection.period) * 86400);
    const [[counts], [profile]] = await Promise.all([
      readWordCounts(fid, start, [end]),
      loadProfiles([fid], 4000).catch(() => [{ fid, username: null, display_name: null }]),
    ]);
    return { ...selection, ...counts, profile };
  },
  ["word-cloud-v3"],
  { revalidate: 300 },
);

export const readGlobalWordCloud = unstable_cache(
  async (selection: GlobalWordCloudSelection): Promise<GlobalWordCloudData> => {
    const end = Number(selection.at) - farcasterEpoch;
    const [counts] = await readWordCounts(null, Math.max(0, end - wordCloudPeriodSeconds(selection.period)), [end]);
    return { ...selection, ...counts, profile: null };
  },
  ["global-word-cloud-v2"],
  { revalidate: 3600 },
);

const readTimelineActivity = unstable_cache(
  async (fid: string, end: number) =>
    query<{ day: number; casts: string | number }>(
      wordCloudActivitySql,
      { fid, start: "0", end: String(end) },
      { timeoutMs: 10000 },
    ),
  ["word-cloud-activity-v1"],
  { revalidate: 300 },
);

const readDailyFrames = unstable_cache(readWordCounts, ["word-cloud-daily-v2"], { revalidate: 300 });

export async function readWordCloudTimeline(fid: string, at: string, page: number): Promise<WordCloudTimelinePage> {
  const end = Number(at) - farcasterEpoch;
  const daily = await readTimelineActivity(fid, end);
  if (!daily.length) return { at, firstDay: Number(at), days: 0, frames: [], activity: [] };
  const firstDayIndex = Number(daily[0].day);
  const first = firstDayIndex * wordCloudDaySeconds;
  const { firstDay, days, frames } = wordCloudTimelineDays(first + farcasterEpoch, Number(at), page);
  let activity: number[] | undefined;
  if (page === 0) {
    const byDay = new Map(daily.map((row) => [Number(row.day), Number(row.casts)]));
    let cumulative = 0;
    activity = Array.from({ length: days }, (_, index) => (cumulative += byDay.get(firstDayIndex + index) ?? 0));
  }
  return {
    at,
    firstDay,
    days,
    activity,
    frames: frames.length
      ? await readDailyFrames(
          fid,
          first,
          frames.map((frame) => frame - farcasterEpoch),
        )
      : [],
  };
}

import type { Profile } from "./activity.ts";

export const wordCloudPeriods = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "365": "Last 365 days",
  all: "All captured history",
} as const;
export type WordCloudPeriod = keyof typeof wordCloudPeriods;
export type WordCloudSelection = { period: WordCloudPeriod; at: string };
export type WordCloudData = WordCloudSelection & { profile: Profile; casts: number; words: [string, number][] };
export const globalWordCloudPeriods = [
  ["1h", "Last complete hour"],
  ["24h", "Last 24 hours"],
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
] as const;
export type GlobalWordCloudPeriod = (typeof globalWordCloudPeriods)[number][0];
export type GlobalWordCloudSelection = { period: GlobalWordCloudPeriod; at: string };
export type GlobalWordCloudData = GlobalWordCloudSelection & Pick<WordCloudData, "casts" | "words"> & { profile: null };

export const farcasterEpoch = 1609459200;
export function globalWordCloudSelection(
  period?: unknown,
  at?: string | null,
  now = Math.floor(Date.now() / 1000),
): GlobalWordCloudSelection {
  const hour = Math.floor(now / 3600) * 3600;
  const selected = period === "1h" || period === "24h" || period === "30" ? period : "7";
  return { period: selected, at: at === String(hour - 3600) ? at : String(hour) };
}

export function wordCloudPeriodSeconds(period: Exclude<WordCloudPeriod, "all"> | GlobalWordCloudPeriod) {
  return period.endsWith("h") ? Number(period.slice(0, -1)) * 3600 : Number(period) * 86400;
}

export function wordCloudSelection(
  period: unknown,
  at: unknown,
  now = Math.floor(Date.now() / 1000),
): WordCloudSelection {
  const selected = period === "7" || period === "365" || period === "all" ? period : "30";
  const minute = Math.floor(now / 60) * 60;
  const supplied = typeof at === "string" && /^\d{10}$/.test(at) ? Number(at) : 0;
  const end = supplied >= farcasterEpoch && supplied <= now ? Math.floor(supplied / 60) * 60 : minute;
  return { period: selected, at: String(end) };
}

export function wordCloudPath(user: string, selection: WordCloudSelection, ts?: string) {
  const params = new URLSearchParams({ user, ...selection });
  if (ts && /^\d{13}$/.test(ts)) params.set("ts", ts);
  return `/word-cloud?${params}`;
}

export function wordCloudRange({ period, at }: WordCloudSelection | GlobalWordCloudSelection) {
  if (period === "1h" || period === "24h") {
    const end = Number(at);
    const clock = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    return `${clock.formatRange((end - wordCloudPeriodSeconds(period)) * 1000, end * 1000)} UTC`;
  }
  const date = (seconds: number) =>
    new Date(seconds * 1000).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return period === "all"
    ? `Through ${date(Number(at))} UTC`
    : `${date(Math.max(farcasterEpoch, Number(at) - wordCloudPeriodSeconds(period)))} – ${date(Number(at))} UTC`;
}

export type WordCloudFrame = { at: string; casts: number; words: WordCloudData["words"] };

export const wordCloudDaySeconds = 86400;
export const wordCloudDaysPerPage = 32;
export type WordCloudTimelinePage = {
  at: string;
  firstDay: number;
  days: number;
  frames: WordCloudFrame[];
  activity?: number[];
};

export function wordCloudTimelineDays(first: number, end: number, page: number) {
  const firstDay = Math.floor(first / wordCloudDaySeconds) * wordCloudDaySeconds;
  const days = first > end ? 0 : Math.floor((end - firstDay) / wordCloudDaySeconds) + 1;
  const offset = page * wordCloudDaysPerPage;
  const frames = Array.from({ length: Math.max(0, Math.min(wordCloudDaysPerPage, days - offset)) }, (_, index) =>
    Math.min(end, firstDay + (offset + index + 1) * wordCloudDaySeconds - 1),
  );
  return { firstDay, days, frames };
}

export function nextWordCloudPlaybackDay(activity: number[], index: number) {
  const last = activity.length - 1;
  if (index >= last) return last;
  const batch = Math.max(5, Math.ceil(activity[last] / 100));
  const target = activity[index] + batch;
  const next = activity.findIndex((casts, day) => day > index && casts >= target);
  return next === -1 ? last : next;
}

const capturedCasts = `
  FROM snapchain.messages AS m FINAL
  PREWHERE m.fid = account AND m.type = 1
  WHERE m.timestamp BETWEEN {start:UInt32} AND {end:UInt32}
    AND m.operation IN ('merge', 'prune') AND notEmpty(trimBoth(m.text))
    AND m.hash NOT IN (
      SELECT target_hash FROM snapchain.cast_removals FINAL
      PREWHERE fid = account
      WHERE operation = 'merge'
    )
`;

const globalCapturedCasts = `
  FROM (
    SELECT toUnixTimestamp(a.timestamp) - 1609459200 AS timestamp, a.text AS text
    FROM snapchain.action_messages AS a FINAL
    PREWHERE a.timestamp >= toDateTime({start:UInt32} + 1609459200, 'UTC')
      AND a.timestamp < toDateTime({end:UInt32} + 1609459200, 'UTC')
    WHERE a.action_type IN ('cast', 'reply') AND notEmpty(trimBoth(a.text))
      AND (a.fid, substring(a.hash, 3)) NOT IN (
        SELECT fid, target_hash FROM snapchain.cast_removals FINAL WHERE operation = 'merge'
      )
  ) AS m
`;

export const wordCloudActivitySql = `
WITH {fid:UInt64} AS account
SELECT intDiv(timestamp, 86400) AS day, count() AS casts
${capturedCasts}
GROUP BY day ORDER BY day
`;

function wordCountsSql(global: boolean) {
  return `
WITH ${global ? "" : "{fid:UInt64} AS account,"}
  map('people','person','children','child','women','woman','men','man',
      'mice','mouse','geese','goose','teeth','tooth','feet','foot',
      'movies','movie','cookies','cookie','lies','lie','ties','tie','buses','bus') AS irregular,
  bucket_counts AS (
    SELECT arrayFirstIndex(cutoff -> timestamp <= cutoff, {frames:Array(UInt32)}) AS bucket,
      word, count() AS occurrences
    FROM (
      SELECT timestamp, arrayFilter(token -> lengthUTF8(token) <= 32
          AND lengthUTF8(replaceRegexpAll(token, {nonLetters:String}, '')) >= 3
          AND NOT has({stopwords:Array(String)}, token),
        extractAll(lowerUTF8(normalizeUTF8NFC(
          replaceAll(replaceRegexpAll(m.text, {exclude:String}, ' '), '’', char(39))
        )), {tokenPattern:String})
      ) AS tokens
      ${global ? globalCapturedCasts : capturedCasts}
    )
    ARRAY JOIN arrayPushFront(tokens, '') AS word
    GROUP BY bucket, word
  ),
  frequencies AS (
    SELECT frame, word, sum(occurrences) AS occurrences
    FROM bucket_counts
    ARRAY JOIN arraySlice({frames:Array(UInt32)}, bucket) AS frame
    GROUP BY frame, word
  ),
  candidates AS (
    SELECT frame, word, occurrences, multiIf(
      NOT match(word, '^[a-z]+$') OR word IN
        ('news','series','species','analytics','politics','economics','physics','mathematics',
         'athletics','gymnastics','diabetes','measles','thanks'), word,
      mapContains(irregular, word), irregular[word],
      endsWith(word, 'ies'), concat(substring(word, 1, length(word) - 3), 'y'),
      match(word, '(ss|x|z|ch|sh|o)es$'), substring(word, 1, length(word) - 2),
      match(word, '[^s]s$'), substring(word, 1, length(word) - 1), word
    ) AS singular
    FROM frequencies
  )
SELECT frame, entry.1 AS term, entry.2 AS occurrences
FROM (
  SELECT frame, if(countIf(word = singular) > 0,
    [(singular, sum(occurrences))],
    groupArray((word, occurrences))) AS entries
  FROM candidates
  GROUP BY frame, singular
)
ARRAY JOIN entries AS entry
ORDER BY frame, (term = '') DESC, occurrences DESC, term
LIMIT 61 BY frame
`;
}

export const wordCloudSql = wordCountsSql(false);
export const globalWordCloudSql = wordCountsSql(true);

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

export const farcasterEpoch = 1609459200;
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

export function wordCloudRange({ period, at }: WordCloudSelection) {
  const date = (seconds: number) =>
    new Date(seconds * 1000).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return period === "all"
    ? `Through ${date(Number(at))} UTC`
    : `${date(Math.max(farcasterEpoch, Number(at) - Number(period) * 86400))} – ${date(Number(at))} UTC`;
}

export type WordCloudFrame = { at: string; casts: number; words: WordCloudData["words"] };

export function wordCloudFrameEnds(first: number, end: number) {
  if (first > end) return [];
  const day = 86400;
  const firstDay = Math.floor(first / day);
  const lastDay = Math.floor(end / day);
  const frames = Math.min(14, lastDay - firstDay + 1);
  return Array.from({ length: frames }, (_, index) => {
    if (index === frames - 1) return end;
    const offset = Math.floor((index * (lastDay - firstDay)) / (frames - 1));
    return (firstDay + offset + 1) * day - 1;
  });
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

export const firstWordCloudCastSql = `
WITH {fid:UInt64} AS account
SELECT minOrNull(timestamp) AS first ${capturedCasts}
`;

export const wordCloudSql = `
WITH {fid:UInt64} AS account,
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
      ${capturedCasts}
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

import { interactionEventsSql } from "./interaction-ranking.ts";

const period =
  "timestamp >= toDateTime({start:Date}, 'UTC') AND timestamp < toDateTime({end:Date}, 'UTC') + INTERVAL 1 DAY";

export const yearReviewOutgoingSql = `
SELECT toDate(timestamp, 'UTC') AS day, count() AS actions,
  countIf(action_type = 'cast') AS casts, countIf(action_type = 'reply') AS replies,
  countIf(action_type = 'recast') AS recasts, countIf(action_type = 'like') AS likes
FROM snapchain.action_messages_by_fid FINAL PREWHERE fid = {fid:UInt64}
WHERE ${period}
GROUP BY day ORDER BY day`;

export const yearReviewFollowsSql = `
SELECT 'out' AS direction, uniqExactIf(target_fid, action_type = 'follow') AS follows,
  uniqExactIf(target_fid, action_type = 'unfollow') AS unfollows
FROM snapchain.action_messages_by_fid FINAL PREWHERE fid = {fid:UInt64}
WHERE ${period} AND action_type IN ('follow', 'unfollow') AND target_fid > 0
UNION ALL
SELECT 'in' AS direction, uniqExactIf(fid, action_type = 'follow') AS follows,
  uniqExactIf(fid, action_type = 'unfollow') AS unfollows
FROM snapchain.received_actions FINAL PREWHERE recipient_fid = {fid:UInt64}
WHERE ${period} AND action_type IN ('follow', 'unfollow') AND fid > 0`;

export const yearReviewReceivedSql = `
WITH {fid:UInt64} AS account, if(type = 1, parent_hash, target_hash) AS cast_hash
SELECT cast_hash, GROUPING(cast_hash) AS all_casts,
  countIf(type = 1) AS replies,
  countIf(type = 3 AND reaction_type = 1) AS likes,
  countIf(type = 3 AND reaction_type = 2) AS recasts,
  uniqExact(fid) AS people
FROM snapchain.messages FINAL
PREWHERE (fid, type, hash) IN (
  SELECT fid, toUInt16(if(action_type = 'reply', 1, 3)), substring(hash, 3)
  FROM snapchain.received_actions FINAL PREWHERE recipient_fid = account
  WHERE ${period} AND action_type IN ('reply', 'like', 'recast') AND fid != account
)
WHERE operation IN ('merge', 'prune')
  AND ((type = 1 AND parent_fid = account) OR (type = 3 AND target_fid = account))
  AND cast_hash IN (
    SELECT hash FROM snapchain.messages FINAL PREWHERE fid = account AND type = 1
    WHERE timestamp >= toUnixTimestamp(toDateTime({start:Date}, 'UTC')) - 1609459200
      AND timestamp < toUnixTimestamp(toDateTime({end:Date}, 'UTC') + INTERVAL 1 DAY) - 1609459200
      AND operation IN ('merge', 'prune') AND empty(parent_hash)
  )
GROUP BY GROUPING SETS ((cast_hash), ())
ORDER BY all_casts DESC, replies + likes + recasts DESC, cast_hash
LIMIT 2`;

export const yearReviewPostSql = `
SELECT substringUTF8(text, 1, 512) AS text, timestamp
FROM snapchain.messages FINAL
PREWHERE fid = {fid:UInt64} AND type = 1 AND hash = {hash:String}
WHERE operation IN ('merge', 'prune')
LIMIT 1`;

export const yearReviewMutualSql = `
WITH {fid:UInt64} AS account, ${interactionEventsSql}
SELECT toString(peer) AS fid, countIf(outgoing = 1) AS sent,
  countIf(outgoing = 0) AS received, least(sent, received) AS mutual
FROM (
  SELECT DISTINCT peer, ts, hash, outgoing FROM events
  WHERE peer != 0 AND peer != account
    AND ts >= toUnixTimestamp(toDateTime({start:Date}, 'UTC'))
    AND ts < toUnixTimestamp(toDateTime({end:Date}, 'UTC') + INTERVAL 1 DAY)
)
GROUP BY peer
HAVING mutual > 0
ORDER BY mutual DESC, peer
LIMIT 7`;

export const yearReviewRatingsSql = `
SELECT subject.metric AS metric, any(subject.score) AS score,
  1 + sumIf(histogram.accounts, histogram.score > subject.score) AS rank,
  100.0 * sumIf(histogram.accounts, histogram.score < subject.score)
    / greatest(sum(histogram.accounts) - 1, 1) AS percentile,
  100.0 * sumIf(histogram.accounts, histogram.score >= subject.score)
    / sum(histogram.accounts) AS topPercent
FROM (
  SELECT end, generated_at, metric, score
  FROM snapchain.year_review_metric_scores
  ARRAY JOIN arrayEnumerate(scores) AS metric, scores AS score
  WHERE fid = {fid:UInt64} AND end = {end:Date}
) AS subject
ALL INNER JOIN (
  SELECT end, generated_at, metric, score, accounts
  FROM snapchain.year_review_metric_histogram WHERE end = {end:Date}
) AS histogram
ON subject.end = histogram.end AND subject.generated_at = histogram.generated_at
  AND subject.metric = histogram.metric
GROUP BY subject.metric`;

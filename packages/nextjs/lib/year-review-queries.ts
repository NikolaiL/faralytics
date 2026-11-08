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
WITH {fid:UInt64} AS account
SELECT countIf(type = 1) AS replies,
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
  AND if(type = 1, parent_hash, target_hash) IN (
    SELECT hash FROM snapchain.messages FINAL PREWHERE fid = account AND type = 1
    WHERE timestamp >= toUnixTimestamp(toDateTime({start:Date}, 'UTC')) - 1609459200
      AND timestamp < toUnixTimestamp(toDateTime({end:Date}, 'UTC') + INTERVAL 1 DAY) - 1609459200
      AND operation IN ('merge', 'prune') AND empty(parent_hash)
  )`;

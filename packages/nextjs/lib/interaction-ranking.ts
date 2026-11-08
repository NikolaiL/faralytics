import type { Profile } from "./activity.ts";

export type InteractionPeriod = "all" | "days30" | "days7";
export type InteractionMetric = "sent" | "received" | "total" | "mutual";
export type InteractionRank = { fid: string; sent: number; received: number; total: number; mutual: number };
export type InteractionRanking = {
  profile: Profile;
  profiles: Profile[];
  rankings: Record<InteractionPeriod, Record<InteractionMetric, InteractionRank[]>>;
};

export const interactionRankingSql = `
WITH {fid:UInt64} AS account,
  toUnixTimestamp(now('UTC')) AS cutoff,
  events AS (
    SELECT arrayJoin(if(type = 1,
      arrayDistinct(arrayConcat(mentions, if(parent_fid != 0 AND notEmpty(parent_hash), [parent_fid], []))),
      [target_fid])) AS peer, timestamp + 1609459200 AS ts, hash, 1 AS outgoing
    FROM snapchain.messages
    PREWHERE fid = account AND type IN (1, 3, 4, 5, 6)
    WHERE operation != 'block_observed' AND (
      type = 1 OR (type IN (3, 4) AND reaction_type IN (1, 2))
      OR (type IN (5, 6) AND link_type = 'follow')
    )
    UNION ALL
    SELECT fid AS peer, toUnixTimestamp(timestamp) AS ts, substring(hash, 3) AS hash, 0 AS outgoing
    FROM snapchain.received_actions
    PREWHERE recipient_fid = account
    WHERE action_type IN ('reply', 'like', 'unlike', 'recast', 'unrecast', 'follow', 'unfollow')
    UNION ALL
    SELECT fid AS peer, timestamp + 1609459200 AS ts, hash, 0 AS outgoing
    FROM snapchain.messages
    PREWHERE type = 1 AND has(mentions, account)
    WHERE operation != 'block_observed'
  )
SELECT period, metric, fid, sent, received, total, least(sent, received) AS mutual
FROM (
SELECT period, toString(peer) AS fid,
  toUInt32(countIf(outgoing = 1)) AS sent,
  toUInt32(countIf(outgoing = 0)) AS received,
  toUInt32(count()) AS total
FROM (
  SELECT DISTINCT peer, ts, hash, outgoing
  FROM events
  WHERE peer != 0 AND peer != account AND ts <= cutoff
)
ARRAY JOIN arrayFilter(period -> period = 'all'
  OR (period = 'days30' AND ts >= cutoff - 30 * 86400)
  OR (period = 'days7' AND ts >= cutoff - 7 * 86400),
  ['all', 'days30', 'days7']) AS period
GROUP BY period, peer
)
ARRAY JOIN ['sent', 'received', 'total', 'mutual'] AS metric
WHERE multiIf(metric = 'sent', sent, metric = 'received', received, metric = 'mutual', mutual, total) > 0
ORDER BY period, metric, multiIf(metric = 'sent', sent, metric = 'received', received, metric = 'mutual', mutual, total) DESC, toUInt64(fid)
LIMIT 25 BY period, metric
`;

export const interactionMetrics = { sent: "Sent", received: "Received", total: "Total", mutual: "Mutual" } as const;

export function interactionSelection(period: unknown, metric: unknown) {
  return {
    period: period === "all" || period === "days30" ? period : "days7",
    metric: metric === "received" || metric === "total" || metric === "sent" ? metric : "mutual",
  } satisfies { period: InteractionPeriod; metric: InteractionMetric };
}

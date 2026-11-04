import type { Profile } from "./activity.ts";

export const FRIENDSHIP_PAGE_SIZE = 20;
export const friendshipLabels = {
  like: "liked",
  unlike: "removed like",
  recast: "recast",
  unrecast: "removed recast",
  follow: "followed",
  unfollow: "unfollowed",
  mention: "mentioned",
  reply: "replied to",
  reply_mention: "replied + mentioned",
};
export type FriendshipAction = keyof typeof friendshipLabels;
export type FriendshipCounts = { all: number; days30: number; days7: number };
export type FriendshipEvent = { ts: number; hash: string; actor: string; action: FriendshipAction; castHash: string };
export type FriendshipPage = {
  profiles: [Profile, Profile];
  counts: Record<string, FriendshipCounts>;
  events: FriendshipEvent[];
  nextCursor: string | null;
};

// One row per captured signed interaction, even if it was observed more than once.
export const friendshipEventsSql = `
  WITH if(fid = {first:UInt64}, {second:UInt64}, {first:UInt64}) AS peer,
    multiIf(
      type = 1 AND parent_fid = peer AND notEmpty(parent_hash) AND has(mentions, peer), 'reply_mention',
      type = 1 AND parent_fid = peer AND notEmpty(parent_hash), 'reply',
      type = 1 AND has(mentions, peer), 'mention',
      type = 3 AND reaction_type = 1, 'like',
      type = 4 AND reaction_type = 1, 'unlike',
      type = 3 AND reaction_type = 2, 'recast',
      type = 4 AND reaction_type = 2, 'unrecast',
      type = 5, 'follow',
      'unfollow'
    ) AS action
  SELECT DISTINCT timestamp, hash, fid, action,
    multiIf(type = 1, hash, type IN (3, 4), target_hash, '') AS cast_hash
  FROM snapchain.messages
  PREWHERE fid IN ({first:UInt64}, {second:UInt64}) AND type IN (1, 3, 4, 5, 6)
  WHERE operation != 'block_observed'
    AND timestamp <= {asOf:UInt32} - 1609459200
    AND (
      (type = 1 AND (has(mentions, peer) OR (parent_fid = peer AND notEmpty(parent_hash))))
      OR (target_fid = peer AND (
        (type IN (3, 4) AND reaction_type IN (1, 2))
        OR (type IN (5, 6) AND link_type = 'follow')
      ))
    )
`;

export const friendshipCountsSql = `
  SELECT toString(fid) AS actor, toUInt32(count()) AS all,
    toUInt32(countIf(timestamp >= {asOf:UInt32} - 1609459200 - 30 * 86400)) AS days30,
    toUInt32(countIf(timestamp >= {asOf:UInt32} - 1609459200 - 7 * 86400)) AS days7
  FROM (${friendshipEventsSql}) GROUP BY fid
`;

export function friendshipPageSql(before: boolean) {
  return `SELECT timestamp + 1609459200 AS ts, concat('0x', events.hash) AS hash,
    toString(fid) AS actor, action, if(empty(cast_hash), '', concat('0x', cast_hash)) AS castHash
    FROM (${friendshipEventsSql}) AS events
    ${before ? "WHERE timestamp <= {beforeTs:UInt32} AND (timestamp, events.hash) < ({beforeTs:UInt32}, {beforeHash:String})" : ""}
    ORDER BY timestamp DESC, hash DESC LIMIT ${FRIENDSHIP_PAGE_SIZE + 1}`;
}

export const friendshipPeriods = [
  ["all", "All time"],
  ["days30", "Last 30 days"],
  ["days7", "Last 7 days"],
] as const;

import "server-only";
import { query } from "./clickhouse";
import { CREATOR_FID, readPublicFollow, readSnapchainFollow, resolveFollowStatus } from "./follow-status";
export function checkCreatorFollow(fid: string) {
  return resolveFollowStatus(fid, {
    database: async () => {
      const rows = await query<{ present: number }>(
        "SELECT 1 AS present FROM farcaster.follows WHERE follower_fid = {fid:UInt64} AND following_fid = {target:UInt64} LIMIT 1",
        { fid, target: CREATOR_FID },
        { timeoutMs: 4000 },
      );
      return rows.length > 0;
    },
    snapchain: () => readSnapchainFollow(fid, process.env.SNAPCHAIN_URL || "http://65.21.162.140:3381"),
    public: () => readPublicFollow(fid),
  });
}

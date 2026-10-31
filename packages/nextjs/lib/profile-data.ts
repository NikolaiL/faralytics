import "server-only";
import { validFid, withUsernameProofs, type Profile } from "./activity";
import { query } from "./clickhouse";

export async function loadProfiles(input: string[], timeoutMs = 35_000): Promise<Profile[]> {
  const fids = [...new Set(input)];
  if (!fids.length) return [];
  if (fids.some((fid) => !validFid(fid))) throw new Error("Invalid profile FID.");
  const rows = await query<Profile>(
    "SELECT toString(p.fid) AS fid, p.username, p.display_name, p.avatar_url AS pfp_url FROM farcaster.profiles AS p WHERE p.fid IN {fids:Array(UInt64)}",
    { fids: `[${fids.join(",")}]` },
    { timeoutMs },
  );
  const byFid = new Map(rows.map((row) => [row.fid, row]));
  const profiles = fids.map((fid) => byFid.get(fid) || { fid, username: null, display_name: null });
  const missing = profiles.filter((profile) => !profile.username).map((profile) => profile.fid);
  if (!missing.length) return profiles;
  try {
    const proofs = await query<{ fid: string; username: string }>(
      "SELECT toString(u.fid) AS fid, u.username FROM farcaster.usernames AS u WHERE u.fid IN {fids:Array(UInt64)}",
      { fids: `[${missing.join(",")}]` },
      { timeoutMs: Math.min(timeoutMs, 4000) },
    );
    return withUsernameProofs(profiles, proofs);
  } catch {
    // A missing registry response must not hide an otherwise usable profile/PFP.
    return profiles;
  }
}

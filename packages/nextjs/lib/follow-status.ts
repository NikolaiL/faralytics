import { validFid } from "./activity.ts";
export const CREATOR_FID = "366713";
export type FollowSource = "clickhouse" | "snapchain" | "public" | "self";
export type FollowCheck = {
  following: boolean | null;
  source: FollowSource | null;
  attempts: { source: FollowSource; status: "following" | "not_following" | "unavailable" }[];
};
export async function resolveFollowStatus(
  fid: string,
  readers: { database: () => Promise<boolean>; snapchain: () => Promise<boolean>; public: () => Promise<boolean> },
): Promise<FollowCheck> {
  if (!validFid(fid)) throw new Error("Invalid viewer FID");
  if (fid === CREATOR_FID) return { following: true, source: "self", attempts: [] };
  const attempts: FollowCheck["attempts"] = [];
  for (const [source, read] of [
    ["clickhouse", readers.database],
    ["snapchain", readers.snapchain],
    ["public", readers.public],
  ] as const) {
    try {
      const following = await read();
      if (typeof following !== "boolean") throw new Error("Invalid follow result");
      attempts.push({ source, status: following ? "following" : "not_following" });
      if (following || source === "public") return { following, source, attempts };
    } catch {
      attempts.push({ source, status: "unavailable" });
    }
  }
  return { following: null, source: null, attempts };
}
async function json(response: Response) {
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error("Follow response too large");
  return JSON.parse(text);
}
export async function readSnapchainFollow(fid: string, base: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  const url = new URL("/v1/linkById", base);
  url.search = new URLSearchParams({ fid, target_fid: CREATOR_FID, link_type: "follow" }).toString();
  const response = await fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(4000), redirect: "error" });
  const body = await json(response);
  if (
    [400, 404].includes(response.status) &&
    /NotFound|not_found|not found/i.test(String(body.error_detail || body.errCode || body.error || ""))
  )
    return false;
  const data = body.data;
  if (
    !response.ok ||
    data?.type !== "MESSAGE_TYPE_LINK_ADD" ||
    String(data.fid) !== fid ||
    data.linkBody?.type !== "follow" ||
    String(data.linkBody.targetFid) !== CREATOR_FID
  )
    throw new Error("Invalid Snapchain follow response");
  return true;
}
export async function readPublicFollow(fid: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  const deadline = Date.now() + 15000;
  const seen = new Set<string>();
  let cursor = "";
  // shortcut: cap public pagination at 30 pages/15s; use a direct public relationship API if larger fallback scans become necessary.
  for (let page = 0; page < 30; page++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Public follow lookup timed out");
    const url = new URL("https://client.farcaster.xyz/v2/following");
    url.search = new URLSearchParams({ fid, limit: "50", ...(cursor ? { cursor } : {}) }).toString();
    const response = await fetcher(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(Math.min(4000, remaining)),
    });
    if (!response.ok) throw new Error("Public follow lookup unavailable");
    const body = await json(response);
    const users = body.result?.users;
    if (
      !Array.isArray(users) ||
      users.length > 50 ||
      users.some(
        (user) =>
          !user || !validFid(String(user.fid)) || (typeof user.fid === "number" && !Number.isSafeInteger(user.fid)),
      )
    )
      throw new Error("Invalid public following list");
    if (users.some((user) => String(user.fid) === CREATOR_FID)) return true;
    if (body.next !== undefined && (!body.next || typeof body.next !== "object"))
      throw new Error("Invalid follow cursor");
    const next = body.next?.cursor;
    if (next !== undefined && typeof next !== "string") throw new Error("Invalid follow cursor");
    if (!next) return false;
    if (next.length > 4096 || seen.has(next)) throw new Error("Repeated follow cursor");
    seen.add(next);
    cursor = next;
  }
  throw new Error("Public following list incomplete");
}

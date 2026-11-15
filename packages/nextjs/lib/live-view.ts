import { InputError, validFid, type Profile } from "./activity.ts";
import { parseTimelineCursor } from "./follow-timeline.ts";

export const liveTypes = {
  all: "All events",
  cast: "Casts",
  reply: "Replies",
  recast: "Recasts",
  like: "Likes",
  mention: "Mentions",
} as const;
export type LiveType = keyof typeof liveTypes;
export type LiveCounts = { casts: number; replies: number; recasts: number; likes: number; mentions: number };
export type LiveEvent = {
  id: string;
  cursor: string;
  timestamp: string;
  action: Exclude<LiveType, "all">;
  actor: Profile;
  target: Profile | null;
  text: string;
  castHash: string;
  mentions: Profile[];
  mentionCount: number;
};
export type LiveData = {
  events: LiveEvent[];
  headCursor: string | null;
  hasMore: boolean;
  profile: Profile | null;
  date: string;
  now: string;
  totals: { today: LiveCounts; yesterday: LiveCounts };
  source: { checkedAt: string | null; catchingUp: boolean; coverage: string };
};
export function liveSelection(params: URLSearchParams) {
  for (const key of ["user", "type", "after"])
    if (params.getAll(key).length > 1) throw new InputError("Choose one value per live filter.");
  const user = (params.get("user") || "").trim().replace(/^@/, "");
  if (user.length > 64 || (user && !/^[a-zA-Z0-9._-]+$/.test(user)) || (/^\d+$/.test(user) && !validFid(user)))
    throw new InputError("Enter a valid username or FID.");
  const type = params.get("type") || "all";
  if (!Object.hasOwn(liveTypes, type)) throw new InputError("Choose a valid event type.");
  const after = params.get("after") || undefined;
  if (after) parseTimelineCursor(after);
  return { user: user || undefined, type: type as LiveType, after };
}
export function liveEventsQuery(user: string | undefined, type: LiveType, after?: string) {
  if (user && !validFid(user)) throw new InputError("Invalid FID.");
  const params: Record<string, string> = { asOf: String(Math.floor(Date.now() / 1000)) };
  const filters = ["timestamp <= toDateTime({asOf:UInt32}, 'UTC')"];
  if (type === "all") filters.push("action_type IN ('cast','reply','recast','like')");
  else if (type === "mention") filters.push("action_type IN ('cast','reply')");
  else {
    filters.push("action_type = {action:String}");
    params.action = type;
  }
  if (user) params.user = user;
  if (after) {
    const cursor = parseTimelineCursor(after);
    params.cursorTs = cursor.ts;
    params.cursorHash = cursor.hash;
    filters.push("timestamp >= toDateTime({cursorTs:UInt32}, 'UTC')");
    filters.push("(timestamp,hash) > (toDateTime({cursorTs:UInt32}, 'UTC'),{cursorHash:String})");
  }
  const order = after ? "ASC" : "DESC";
  return {
    sql: `SELECT toUnixTimestamp(timestamp) AS ts, hash, toString(fid) AS actor, action_type,
      substringUTF8(text,1,512) AS body, toString(parent_fid) AS parent, toString(target_fid) AS target,
      parent_hash, target_hash FROM snapchain.${user ? "action_messages_by_fid" : "action_messages"}
      ${user ? "PREWHERE fid = {user:UInt64}" : ""}
      WHERE ${filters.join(" AND ")} ORDER BY timestamp ${order},hash ${order} LIMIT 61`,
    params,
  };
}
export function mergeLiveEvents(current: LiveEvent[], incoming: LiveEvent[]) {
  return [...new Map([...current, ...incoming].map((event) => [event.id, event])).values()]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id))
    .slice(0, 100);
}
export function liveClockParts(now: number) {
  const date = new Date(now);
  return {
    year: date.getUTCFullYear(),
    month: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

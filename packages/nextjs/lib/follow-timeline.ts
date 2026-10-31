import { InputError, validFid, type Profile } from "./activity.ts";

export const TIMELINE_PAGE_SIZE = 20;
export type TimelineCursor = { ts: string; hash: string };
export type TimelineEvent = {
  id: string;
  timestamp: string;
  cursor: string;
  action: "follow" | "unfollow";
  actor: Profile;
  target: Profile;
};
export type TimelinePage = {
  events: TimelineEvent[];
  filters: { actor: Profile | null; target: Profile | null };
  headCursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  updatedAt: string;
};
export function parseTimelineCursor(value: string): TimelineCursor {
  const match = /^(\d{10}):(0x[0-9a-f]{40})$/.exec(value);
  if (!match || Number(match[1]) < 1609459200 || Number(match[1]) > 4102444800)
    throw new InputError("Invalid timeline cursor.");
  return { ts: match[1], hash: match[2] };
}
export function timelineSelection(params: URLSearchParams) {
  for (const key of ["actor", "target", "before", "after"])
    if (params.getAll(key).length > 1) throw new InputError("Use one value for each timeline filter.");
  const account = (key: string) => {
    const value = (params.get(key) || "").trim().replace(/^@/, "");
    if (value.length > 64 || (value && !/^[a-zA-Z0-9._-]+$/.test(value)))
      throw new InputError("Enter a username or FID.");
    if (/^\d+$/.test(value) && !validFid(value)) throw new InputError("Invalid FID.");
    return value || undefined;
  };
  const before = params.get("before") || undefined;
  const after = params.get("after") || undefined;
  if (before && after) throw new InputError("Choose older or newer events, not both.");
  if (before) parseTimelineCursor(before);
  if (after) parseTimelineCursor(after);
  return { actor: account("actor"), target: account("target"), before, after };
}
export function validateTimelineShareTime(value: string) {
  if (!/^\d{13}$/.test(value) || Number(value) < 1609459200000 || Number(value) > Date.now() + 60000)
    throw new InputError("Invalid share timestamp.");
}
export function timelineQuery(selection: {
  actor?: string;
  target?: string;
  before?: string;
  after?: string;
  shareAt?: string;
}) {
  const { actor, target, before, after, shareAt } = selection;
  if ((actor && !validFid(actor)) || (target && !validFid(target))) throw new InputError("Invalid FID.");
  if (before && after) throw new InputError("Invalid cursor direction.");
  const table = target ? "received_actions" : actor ? "action_messages_by_fid" : "action_messages";
  const targetColumn = target ? "recipient_fid" : "target_fid";
  const params: Record<string, string> = {};
  const filters = ["action_type IN ('follow', 'unfollow')"];
  if (shareAt) {
    validateTimelineShareTime(shareAt);
    filters.push("action_type = 'follow'", "timestamp <= toDateTime({asOf:UInt32}, 'UTC')");
    params.asOf = Math.floor(Number(shareAt) / 1000).toString();
  }
  let prewhere = "";
  if (target) {
    prewhere = "PREWHERE recipient_fid = {target:UInt64}";
    params.target = target;
    if (actor) filters.push("fid = {actor:UInt64}");
  } else if (actor) prewhere = "PREWHERE fid = {actor:UInt64}";
  if (actor) params.actor = actor;
  if (before || after) {
    const cursor = parseTimelineCursor((before || after)!);
    params.cursorTs = cursor.ts;
    params.cursorHash = cursor.hash;
    filters.push(`(timestamp, hash) ${after ? ">" : "<"} (toDateTime({cursorTs:UInt32}, 'UTC'), {cursorHash:String})`);
  }
  const direction = after ? "ASC" : "DESC";
  // Identical signed actions can be inserted again on prune/revoke; deduplicate while retaining ordered early reads.
  return {
    sql: `SELECT toUnixTimestamp(timestamp) AS ts, hash, toString(fid) AS actor,
      toString(${targetColumn}) AS target, action_type
      FROM snapchain.${table} ${prewhere}
      WHERE ${filters.join(" AND ")}
      ORDER BY timestamp ${direction}, hash ${direction}
      LIMIT 1 BY ${shareAt && target && !actor ? "fid" : shareAt && actor && !target ? targetColumn : "timestamp, hash, fid, action_type"}
      LIMIT ${TIMELINE_PAGE_SIZE + 1}`,
    params,
  };
}
export function mergeTimeline(events: TimelineEvent[], incoming: TimelineEvent[]) {
  return [...new Map([...events, ...incoming].map((event) => [event.id, event])).values()].sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id),
  );
}
export function relativeEventTime(timestamp: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(timestamp)) / 1000));
  const [amount, unit] =
    seconds < 60
      ? [seconds, "second"]
      : seconds < 3600
        ? [Math.floor(seconds / 60), "minute"]
        : seconds < 86400
          ? [Math.floor(seconds / 3600), "hour"]
          : [Math.floor(seconds / 86400), "day"];
  return `${amount} ${unit}${amount === 1 ? "" : "s"} ago`;
}

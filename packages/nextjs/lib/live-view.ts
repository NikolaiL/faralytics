import { InputError, validFid, type Profile } from "./activity.ts";
import { parseTimelineCursor } from "./follow-timeline.ts";

export const liveTypes = {
  all: "All events",
  cast: "Casts",
  reply: "Replies",
  recast: "Recasts",
  like: "Likes",
  mention: "Mentions",
  follow: "Follows",
  unfollow: "Unfollows",
  unlike: "Unlikes",
  unrecast: "Unrecasts",
  cast_delete: "Cast deletions",
} as const;
export type LiveType = keyof typeof liveTypes;
export const liveDirections = { actor: "By user", target: "To user", both: "Both" } as const;
export type LiveDirection = keyof typeof liveDirections;
export const liveMetricLabels = {
  casts: "Casts",
  replies: "Replies",
  recasts: "Recasts",
  likes: "Likes",
  mentions: "Mentions",
  dau: "DAU",
} as const;
export type LiveCounts = Record<keyof typeof liveMetricLabels, number>;
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
  quotes?: { author: Profile; hash: string; text: string | null }[];
};
export type LiveData = {
  events: LiveEvent[];
  headCursor: string | null;
  hasMore: boolean;
  profile: Profile | null;
  date: string;
  now: string;
  totals: { today: LiveCounts; yesterday: LiveCounts; asOf: string };
  source: { checkedAt: string | null; catchingUp: boolean; coverage: string };
};
export function liveSelection(params: URLSearchParams) {
  for (const key of ["user", "type", "direction", "after", "share"])
    if (params.getAll(key).length > 1) throw new InputError("Choose one value per live filter.");
  const user = (params.get("user") || "").trim().replace(/^@/, "");
  if (user.length > 64 || (user && !/^[a-zA-Z0-9._-]+$/.test(user)) || (/^\d+$/.test(user) && !validFid(user)))
    throw new InputError("Enter a valid username or FID.");
  const type = params.get("type") || "all";
  if (!Object.hasOwn(liveTypes, type)) throw new InputError("Choose a valid event type.");
  const direction = params.get("direction") || "actor";
  if (!Object.hasOwn(liveDirections, direction)) throw new InputError("Choose a valid user role.");
  const share = params.get("share");
  if (share !== null && !/^[a-f0-9]{64}$/.test(share)) throw new InputError("Invalid activity snapshot.");
  const after = params.get("after") || undefined;
  if (after) parseTimelineCursor(after);
  return {
    user: user || undefined,
    type: type as LiveType,
    direction: (user ? direction : "actor") as LiveDirection,
    after,
  };
}
export function liveEventsQuery(
  user: string | undefined,
  type: LiveType,
  after?: string,
  direction: LiveDirection = "actor",
) {
  if (user && !validFid(user)) throw new InputError("Invalid FID.");
  const params: Record<string, string> = { asOf: String(Math.floor(Date.now() / 1000)) };
  const filters = ["timestamp <= toDateTime({asOf:UInt32}, 'UTC')"];
  if (type === "all") {
    filters.push("action_type IN {actions:Array(String)}");
    params.actions =
      "[" +
      Object.keys(liveTypes)
        .filter((key) => key !== "all" && key !== "mention")
        .map((key) => `'${key}'`)
        .join(",") +
      "]";
  } else if (type === "mention") filters.push("action_type IN ('cast','reply')");
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
  const clauses = filters.join(" AND ");
  const columns = `toUnixTimestamp(timestamp) AS ts,hash,toString(fid) AS actor,action_type,
    substringUTF8(text,1,512) AS body,toString(parent_fid) AS parent,toString(target_fid) AS target,parent_hash,target_hash`;
  if (!user || direction === "actor")
    return {
      sql: `SELECT ${columns} FROM snapchain.${user ? "action_messages_by_fid" : "action_messages"}
    ${user ? "PREWHERE fid = {user:UInt64}" : ""} WHERE ${clauses} ORDER BY timestamp ${order},hash ${order} LIMIT 61`,
      params,
    };
  const streams: string[] = [];
  const add = (table: string, prewhere: string, extra = "") =>
    streams.push(
      `SELECT fid,timestamp,hash FROM (SELECT fid,timestamp,hash FROM snapchain.${table} PREWHERE ${prewhere} WHERE ${clauses}${extra} ORDER BY timestamp ${order},hash ${order} LIMIT 61)`,
    );
  if (direction === "both") add("action_messages_by_fid", "fid = {user:UInt64}");
  add("received_actions", "recipient_fid = {user:UInt64}");
  if (["all", "cast", "reply", "mention"].includes(type))
    add("live_cast_recipients", "recipient_fid = {user:UInt64}", type === "mention" ? " AND is_mention=1" : "");
  if (direction === "target" && (type === "all" || type === "cast_delete"))
    add("action_messages_by_fid", "fid = {user:UInt64}", " AND action_type='cast_delete'");
  return {
    sql: `SELECT ${columns} FROM snapchain.action_messages_by_fid
    PREWHERE (fid,timestamp,hash) IN (SELECT DISTINCT fid,timestamp,hash FROM (${streams.join(" UNION ALL ")}) ORDER BY timestamp ${order},hash ${order} LIMIT 61)
    ORDER BY timestamp ${order},hash ${order} LIMIT 61`,
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

export type LiveSnapshot = Pick<LiveData, "date" | "totals" | "source" | "profile"> & {
  type: LiveType;
  direction?: LiveDirection;
  events?: LiveEvent[];
};
export function livePath(selection: { user?: string; type: LiveType; direction?: LiveDirection }, share?: string) {
  const params = new URLSearchParams();
  if (selection.user) params.set("user", selection.user);
  if (selection.type !== "all") params.set("type", selection.type);
  if (selection.user && selection.direction && selection.direction !== "actor")
    params.set("direction", selection.direction);
  if (share) params.set("share", share);
  return `/live-view${params.size ? `?${params}` : ""}`;
}

// ClickHouse extracts the FID as raw JSON to avoid rounding UInt64 values in JSON.parse.
export function liveQuoteIds(embeds: [string, string][]) {
  const quotes = new Map<string, { fid: string; hash: string }>();
  for (const [rawFid, rawHash] of embeds.slice(0, 4)) {
    try {
      const fid = rawFid.startsWith('"') ? JSON.parse(rawFid) : rawFid;
      const value = JSON.parse(rawHash);
      const bytes = value?.type === "Buffer" ? value.data : null;
      const hash =
        typeof value === "string"
          ? value.replace(/^0x/, "").toLowerCase()
          : Array.isArray(bytes) &&
              bytes.length === 20 &&
              bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
            ? bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")
            : "";
      if (typeof fid === "string" && validFid(fid) && /^[a-f0-9]{40}$/.test(hash))
        quotes.set(`${fid}:${hash}`, { fid, hash: "0x" + hash });
    } catch {
      /* Ignore URL embeds and malformed cast IDs. */
    }
  }
  return [...quotes.values()];
}

export function liveEventAction(event: LiveEvent) {
  const ownHash = event.cursor.split(":")[1];
  const quote = event.action === "cast" ? event.quotes?.[0] : undefined;
  const verbs: Record<Exclude<LiveType, "all">, string> = {
    cast: quote ? "quote-recasted" : "casted",
    reply: "replied",
    recast: "recasted",
    like: "liked",
    mention: "mentioned",
    follow: "followed",
    unfollow: "unfollowed",
    unlike: "unliked",
    unrecast: "unrecasted",
    cast_delete: "deleted",
  };
  const profileAction = event.action === "follow" || event.action === "unfollow";
  const actionHash = ["cast", "reply", "mention"].includes(event.action) ? ownHash : event.castHash;
  return {
    verb: verbs[event.action],
    actionHash,
    actionUrl: profileAction
      ? `https://farcaster.xyz/${event.target?.username || `~/profiles/${event.target?.fid || event.actor.fid}`}`
      : `https://farcaster.xyz/~/conversations/${actionHash}`,
    castHash:
      quote?.hash ??
      (["reply", "like", "recast", "unlike", "unrecast", "cast_delete"].includes(event.action) ? event.castHash : null),
    connector: event.action === "reply" ? " to a " : " a ",
    target: event.action === "cast_delete" ? null : (quote?.author ?? event.target),
    profileAction,
  };
}
export function liveOgEventHeight(event: LiveEvent) {
  return 40 + (event.text ? 22 : 0) + (event.quotes?.length ? 40 : 0);
}
export function liveOgEvents(events: LiveEvent[], height: number) {
  const visible: LiveEvent[] = [];
  let remaining = height - 250;
  for (const event of events.slice(0, 20)) {
    const size = liveOgEventHeight(event) + (visible.length ? 6 : 0);
    if (size > remaining) break;
    visible.push(event);
    remaining -= size;
  }
  return visible;
}

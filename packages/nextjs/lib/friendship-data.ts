import "server-only";
import { InputError, type Profile } from "~~/lib/activity";
import { query } from "~~/lib/clickhouse";
import { resolveAccount } from "~~/lib/data";
import { parseTimelineCursor, validateTimelineShareTime } from "~~/lib/follow-timeline";
import {
  FRIENDSHIP_PAGE_SIZE,
  friendshipCountsSql,
  friendshipPageSql,
  type FriendshipCounts,
  type FriendshipEvent,
} from "~~/lib/friendship";
import { loadProfiles } from "~~/lib/profile-data";

export async function loadFriendship(params: URLSearchParams) {
  const ts = params.get("ts") || Date.now().toString();
  validateTimelineShareTime(ts);
  const asOf = String(Math.floor(Number(ts) / 1000));
  const cursor = params.get("before");
  const before = cursor ? parseTimelineCursor(cursor) : undefined;
  const [first, second] = await Promise.all([
    resolveAccount(params.get("first") || ""),
    resolveAccount(params.get("second") || ""),
  ]);
  if (first === second) throw new InputError("Choose two different accounts.");
  const ids = { first, second, asOf };
  const options = { timeoutMs: 12000 };
  const [rows, profiles, counts] = await Promise.all([
    query<FriendshipEvent>(
      friendshipPageSql(!!before),
      before ? { ...ids, beforeTs: String(Number(before.ts) - 1609459200), beforeHash: before.hash.slice(2) } : ids,
      options,
    ),
    before
      ? []
      : loadProfiles([first, second], 4000).catch((): Profile[] => [
          { fid: first, username: null, display_name: null },
          { fid: second, username: null, display_name: null },
        ]),
    before ? [] : query<FriendshipCounts & { actor: string }>(friendshipCountsSql, ids, options),
  ]);
  const events = rows.slice(0, FRIENDSHIP_PAGE_SIZE);
  const last = events.at(-1);
  return {
    profiles,
    counts: Object.fromEntries(counts.map(({ actor, ...counts }) => [actor, counts])),
    events,
    nextCursor: last && rows.length > FRIENDSHIP_PAGE_SIZE ? `${last.ts}:${last.hash}` : null,
  };
}

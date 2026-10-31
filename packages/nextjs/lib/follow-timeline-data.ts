import "server-only";
import { unstable_cache } from "next/cache";
import { query } from "./clickhouse";
import { loadProfiles } from "./profile-data";
import { resolveAccount } from "./data";
import type { Profile } from "./activity";
import { timelineQuery, TIMELINE_PAGE_SIZE, type TimelinePage } from "./follow-timeline";

type Selection = { actor?: string; target?: string; before?: string; after?: string; shareAt?: string };
const readTimeline = unstable_cache(
  async (key: string): Promise<TimelinePage> => {
    const selection = JSON.parse(key) as Selection;
    const { sql, params } = timelineQuery(selection);
    const rows = await query<{
      ts: number;
      hash: string;
      actor: string;
      target: string;
      action_type: "follow" | "unfollow";
    }>(sql, params, { timeoutMs: 15000 });
    const hasMore = rows.length > TIMELINE_PAGE_SIZE;
    const page = rows.slice(0, TIMELINE_PAGE_SIZE);
    if (selection.after) page.reverse();
    const ids = [
      ...new Set(
        [...page.flatMap((r) => [r.actor, r.target]), selection.actor, selection.target].filter(
          (fid): fid is string => !!fid,
        ),
      ),
    ];
    let profiles: Profile[] = [];
    if (ids.length) {
      try {
        profiles = await loadProfiles(ids, 4000);
      } catch {
        /* Events remain usable when profile enrichment is unavailable. */
      }
    }
    const profile = (fid: string): Profile =>
      profiles.find((p) => p.fid === fid) || { fid, username: null, display_name: null };
    const events = page.map((r) => ({
      id: r.hash,
      cursor: `${r.ts}:${r.hash}`,
      timestamp: new Date(Number(r.ts) * 1000).toISOString(),
      action: r.action_type,
      actor: profile(r.actor),
      target: profile(r.target),
    }));
    return {
      events,
      filters: {
        actor: selection.actor ? profile(selection.actor) : null,
        target: selection.target ? profile(selection.target) : null,
      },
      headCursor: events[0]?.cursor || null,
      nextCursor: events.at(-1)?.cursor || null,
      hasMore,
      updatedAt: new Date().toISOString(),
    };
  },
  ["follow-timeline-v3"],
  { revalidate: 5 },
);

export async function loadTimeline(selection: Selection) {
  const [actor, target] = await Promise.all([
    selection.actor ? resolveAccount(selection.actor) : undefined,
    selection.target ? resolveAccount(selection.target) : undefined,
  ]);
  return readTimeline(JSON.stringify({ ...selection, actor, target }));
}

export async function loadTimelineShare(selection: { actor?: string; target?: string }, ts: string) {
  const data = await loadTimeline({ ...selection, shareAt: ts });
  return {
    filters: data.filters,
    events: data.events.slice(0, 10),
    generatedAt: new Date(Number(ts)).toISOString(),
  };
}

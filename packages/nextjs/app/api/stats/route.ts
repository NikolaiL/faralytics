import { unstable_cache } from "next/cache";
import { getDb } from "~~/utils/db";
import { loadProfiles } from "~~/lib/profile-data";
import type { LookupStats } from "~~/lib/lookup-stats";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 60;
const profileNames = unstable_cache(
  async (fids: string[]) =>
    (await loadProfiles(fids)).map(({ fid, username, display_name }) => ({ fid, username, display_name })),
  ["stats-profile-names-v2"],
  { revalidate: 300 },
);
export const GET = withErrorReporting("/api/stats", async () => {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  try {
    const sql = getDb();
    // Select public display fields explicitly: never return IPs, cookie IDs or raw metadata.
    const [latest, popular, totals, topUsers] = (await sql.transaction([
      sql`SELECT e.lookup_id AS "lookupId", e.tool, e.created_at AS "startedAt",
        COALESCE((e.metadata->>'last_seen_at')::timestamptz, e.created_at) AS "lastViewedAt",
        e.viewer_fid::text AS "viewerFid",
        (SELECT COALESCE((array_agg(a.fid::text ORDER BY a.position))[1:20], ARRAY[]::text[]) FROM lookup_accounts a WHERE a.lookup_id=e.lookup_id) AS fids,
        (SELECT count(*)::text FROM lookup_accounts a WHERE a.lookup_id=e.lookup_id) AS "accountCount"
        FROM lookup_events e
        ORDER BY COALESCE((e.metadata->>'last_seen_at')::timestamptz, e.created_at) DESC, e.lookup_id
        LIMIT 50`,
      sql`SELECT fid::text, count(*)::text AS lookups FROM lookup_accounts GROUP BY fid ORDER BY count(*) DESC, fid LIMIT 20`,
      sql`SELECT (SELECT count(*)::text FROM lookup_events) AS sessions,
        count(*)::text AS lookups, count(DISTINCT fid)::text AS fids FROM lookup_accounts`,
      sql`SELECT viewer_fid::text AS fid, count(*)::text AS lookups FROM lookup_events
        WHERE viewer_fid IS NOT NULL GROUP BY viewer_fid ORDER BY count(*) DESC, viewer_fid LIMIT 20`,
    ])) as unknown as [LookupStats["latest"], LookupStats["popular"], LookupStats["totals"][], LookupStats["topUsers"]];
    const fids = [
      ...new Set([
        ...latest.flatMap((row) => [...row.fids, ...(row.viewerFid ? [row.viewerFid] : [])]),
        ...popular.map((row) => row.fid),
        ...topUsers.map((row) => row.fid),
      ]),
    ].sort();
    let profiles: LookupStats["profiles"] = [],
      namesAvailable = true;
    if (fids.length) {
      try {
        profiles = await profileNames(fids);
      } catch {
        namesAvailable = false;
      }
    }
    const data: LookupStats = {
      updatedAt: new Date().toISOString(),
      totals: totals[0],
      latest,
      popular,
      topUsers,
      profiles,
      namesAvailable,
    };
    return Response.json(data, { headers });
  } catch (error) {
    reportServerError(error, "/api/stats");
    return Response.json({ error: "Lookup stats are temporarily unavailable." }, { status: 503, headers });
  }
});

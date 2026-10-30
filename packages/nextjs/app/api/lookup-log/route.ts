import { createClient } from "@farcaster/quick-auth";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { validFid } from "~~/lib/activity";
import { parseLookup, UUID_PATTERN } from "~~/lib/lookup-log";
import { getDb } from "~~/utils/db";
import { withErrorReporting, reportServerError } from "~~/utils/reportServerError";
export const runtime = "nodejs";
const auth = createClient();
export const POST = withErrorReporting("/api/lookup-log", async (request) => {
  let origin: URL;
  try {
    origin = new URL(request.headers.get("origin") || "");
  } catch {
    return Response.json({ error: "Same-origin request required." }, { status: 403 });
  }
  // Next's listening address can differ from the browser-facing Host behind a proxy.
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.host !== request.headers.get("host") ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return Response.json({ error: "Same-origin request required." }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 2048) return Response.json({ error: "Lookup too large." }, { status: 413 });
  let lookup: ReturnType<typeof parseLookup>;
  try {
    lookup = parseLookup(JSON.parse(raw));
  } catch {
    return Response.json({ error: "Invalid lookup." }, { status: 400 });
  }
  let viewerFid: string | null = null;
  const authorization = request.headers.get("authorization");
  if (authorization) {
    if (!authorization.startsWith("Bearer ") || authorization.length > 8192)
      return Response.json({ error: "Invalid viewer authentication." }, { status: 401 });
    try {
      const domain = new URL(process.env.NEXT_PUBLIC_URL || request.nextUrl.origin).host;
      const payload = await auth.verifyJwt({ token: authorization.slice(7), domain });
      const fid = String(payload.sub);
      if (!validFid(fid)) throw new Error("Invalid subject");
      viewerFid = fid;
    } catch {
      return Response.json({ error: "Invalid viewer authentication." }, { status: 401 });
    }
  }
  const existing = request.cookies.get("faralytics_viewer")?.value;
  const anonymousId = existing && UUID_PATTERN.test(existing) ? existing : randomUUID();
  const userId = viewerFid ? `fid:${viewerFid}` : `anon:${anonymousId}`;
  // Vercel supplies this header at its trusted edge; do not trust arbitrary forwarded headers locally.
  const forwarded = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    : undefined;
  const viewerIp = !viewerFid && forwarded && isIP(forwarded) ? forwarded : null;
  try {
    const sql = getDb();
    const [, sessions] = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${lookup.lookupId}::text, 0))`,
      sql`INSERT INTO lookup_events (lookup_id, tool, user_id, viewer_fid, viewer_ip, identity_source, metadata)
        VALUES (${lookup.lookupId}::uuid, ${lookup.tool}, ${userId}, ${viewerFid}::numeric, ${viewerIp}::inet,
          ${viewerFid ? "quick_auth" : "anonymous"}, ${JSON.stringify({ ...lookup.metadata, anonymous_id: anonymousId })}::jsonb || jsonb_build_object('last_seen_at', now()))
        ON CONFLICT (lookup_id) DO UPDATE SET
          metadata = EXCLUDED.metadata,
          viewer_fid = COALESCE(lookup_events.viewer_fid, EXCLUDED.viewer_fid),
          user_id = CASE WHEN EXCLUDED.viewer_fid IS NOT NULL THEN EXCLUDED.user_id ELSE lookup_events.user_id END,
          identity_source = CASE WHEN EXCLUDED.viewer_fid IS NOT NULL THEN EXCLUDED.identity_source ELSE lookup_events.identity_source END,
          viewer_ip = CASE WHEN COALESCE(lookup_events.viewer_fid, EXCLUDED.viewer_fid) IS NULL THEN COALESCE(lookup_events.viewer_ip, EXCLUDED.viewer_ip) ELSE NULL END
        WHERE lookup_events.tool = EXCLUDED.tool
          AND (lookup_events.user_id = EXCLUDED.user_id OR lookup_events.user_id = ${`anon:${anonymousId}`} OR lookup_events.metadata->>'anonymous_id' = ${anonymousId})
        RETURNING lookup_id`,
      sql`WITH new_accounts AS (
        SELECT incoming.fid::numeric AS fid, incoming.ordinality
        FROM unnest(${lookup.fids}::text[]) WITH ORDINALITY AS incoming(fid, ordinality)
        WHERE NOT EXISTS (SELECT 1 FROM lookup_accounts a WHERE a.lookup_id = ${lookup.lookupId}::uuid AND a.fid = incoming.fid::numeric)
      ) INSERT INTO lookup_accounts (lookup_id, fid, position)
        SELECT ${lookup.lookupId}::uuid, new_accounts.fid,
          ((SELECT COALESCE(max(position), -1) FROM lookup_accounts WHERE lookup_id = ${lookup.lookupId}::uuid)
            + row_number() OVER (ORDER BY new_accounts.ordinality))::smallint
        FROM new_accounts
        WHERE EXISTS (SELECT 1 FROM lookup_events WHERE lookup_id = ${lookup.lookupId}::uuid AND tool = ${lookup.tool}
          AND (user_id = ${userId} OR user_id = ${`anon:${anonymousId}`} OR metadata->>'anonymous_id' = ${anonymousId}))
        ON CONFLICT (lookup_id, fid) DO NOTHING`,
    ]);
    if (!Array.isArray(sessions) || !sessions.length)
      return Response.json({ error: "Lookup session does not match this viewer or tool." }, { status: 409 });
    const response = NextResponse.json({ lookupId: lookup.lookupId }, { headers: { "Cache-Control": "no-store" } });
    if (!existing || existing !== anonymousId)
      response.cookies.set("faralytics_viewer", anonymousId, {
        httpOnly: true,
        secure: origin.protocol === "https:",
        sameSite: origin.protocol === "https:" ? "none" : "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        partitioned: origin.protocol === "https:",
      });
    return response;
  } catch (error) {
    reportServerError(error, "/api/lookup-log");
    console.error("Lookup log write failed", { code: (error as { code?: string }).code || "DATABASE_UNAVAILABLE" });
    return Response.json({ error: "Logging temporarily unavailable." }, { status: 503 });
  }
});

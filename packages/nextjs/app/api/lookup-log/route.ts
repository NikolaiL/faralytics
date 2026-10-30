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
    await sql`WITH inserted AS (
      INSERT INTO lookup_events (lookup_id, tool, user_id, viewer_fid, viewer_ip, identity_source, metadata)
      VALUES (${lookup.lookupId}::uuid, ${lookup.tool}, ${userId}, ${viewerFid}::numeric, ${viewerIp}::inet,
        ${viewerFid ? "quick_auth" : "anonymous"}, ${JSON.stringify(lookup.metadata)}::jsonb)
      ON CONFLICT (lookup_id) DO NOTHING RETURNING lookup_id
    ) INSERT INTO lookup_accounts (lookup_id, fid, position)
      SELECT inserted.lookup_id, accounts.fid::numeric, (accounts.ordinality - 1)::smallint
      FROM inserted CROSS JOIN unnest(${lookup.fids}::text[]) WITH ORDINALITY AS accounts(fid, ordinality)`;
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

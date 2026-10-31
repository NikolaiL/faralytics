import { createClient } from "@farcaster/quick-auth";
import { validFid } from "~~/lib/activity";
import { CREATOR_FID } from "~~/lib/follow-status";
import { checkCreatorFollow } from "~~/lib/follow-data";
import { withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 30;
const auth = createClient();
export const POST = withErrorReporting("/api/follow-status", async (request) => {
  let origin: URL;
  try {
    origin = new URL(request.headers.get("origin") || "");
  } catch {
    return Response.json({ error: "Same-origin request required." }, { status: 403 });
  }
  if (
    !["https:", "http:"].includes(origin.protocol) ||
    origin.host !== request.headers.get("host") ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return Response.json({ error: "Same-origin request required." }, { status: 403 });
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 8192)
    return Response.json({ error: "Farcaster authentication required." }, { status: 401 });
  let fid: string;
  try {
    const domain = new URL(process.env.NEXT_PUBLIC_URL || request.nextUrl.origin).host;
    const payload = await auth.verifyJwt({ token: authorization.slice(7), domain });
    fid = String(payload.sub);
    if (!validFid(fid)) throw new Error("Invalid subject");
  } catch {
    return Response.json({ error: "Farcaster authentication required." }, { status: 401 });
  }
  const result = await checkCreatorFollow(fid);
  return Response.json(
    { ...result, viewerFid: fid, targetFid: CREATOR_FID, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
});

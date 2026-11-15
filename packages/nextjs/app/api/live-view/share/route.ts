import { InputError } from "~~/lib/activity";
import { createLiveShare } from "~~/lib/live-view-shares";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 45;
export const POST = withErrorReporting("/api/live-view/share", async (request) => {
  try {
    const text = await request.text();
    if (text.length > 2048) throw new InputError("Request too large.", 413);
    const input = JSON.parse(text);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new InputError("Invalid activity share.");
    return Response.json(await createLiveShare(input), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid activity share." }, { status: 400 });
    reportServerError(error, "/api/live-view/share");
    return Response.json({ error: "Could not prepare this activity share. Please try again." }, { status: 502 });
  }
});

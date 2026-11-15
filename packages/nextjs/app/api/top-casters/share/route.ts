import { InputError } from "~~/lib/activity";
import { createCasterShare } from "~~/lib/top-caster-shares";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 45;
export const POST = withErrorReporting("/api/top-casters/share", async (request) => {
  try {
    const text = await request.text();
    if (text.length > 2048) throw new InputError("Request too large.", 413);
    const input = JSON.parse(text);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new InputError("Invalid share request.");
    return Response.json(await createCasterShare(input), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid share request." }, { status: 400 });
    reportServerError(error, "/api/top-casters/share");
    return Response.json({ error: "Could not prepare this ranking share. Please try again." }, { status: 502 });
  }
});

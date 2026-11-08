import { InputError } from "~~/lib/activity";
import { resolveAccount } from "~~/lib/data";
import { readInteractionRanking } from "~~/lib/interaction-ranking-data";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";

export const runtime = "nodejs";
export const maxDuration = 45;

export const GET = withErrorReporting("/api/interactions", async (request) => {
  try {
    const fid = await resolveAccount(request.nextUrl.searchParams.get("user") || "");
    return Response.json(await readInteractionRanking(fid), { headers: { "Cache-Control": "private, max-age=120" } });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/interactions");
    return Response.json({ error: "Could not load interaction rankings. Try again." }, { status: 502 });
  }
});

import { InputError } from "~~/lib/activity";
import { loadFriendship } from "~~/lib/friendship-data";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";

export const runtime = "nodejs";
export const maxDuration = 30;
export const GET = withErrorReporting("/api/friendship", async (request) => {
  try {
    const params = request.nextUrl.searchParams;
    return Response.json(await loadFriendship(params), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/friendship");
    return Response.json({ error: "Could not load friendship activity. Try again." }, { status: 502 });
  }
});

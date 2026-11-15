import { InputError } from "~~/lib/activity";
import { liveSelection } from "~~/lib/live-view";
import { loadLiveView } from "~~/lib/live-view-data";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 30;
export const GET = withErrorReporting("/api/live-view", async (request) => {
  try {
    return Response.json(await loadLiveView(liveSelection(request.nextUrl.searchParams)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/live-view");
    return Response.json({ error: "Could not load live activity. Please try again." }, { status: 502 });
  }
});

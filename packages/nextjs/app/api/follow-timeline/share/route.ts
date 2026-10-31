import { InputError } from "~~/lib/activity";
import { timelineSelection } from "~~/lib/follow-timeline";
import { loadTimelineShare } from "~~/lib/follow-timeline-data";
import { withErrorReporting, reportServerError } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 30;
export const GET = withErrorReporting("/api/follow-timeline/share", async (request) => {
  try {
    const params = request.nextUrl.searchParams;
    const { actor, target } = timelineSelection(params);
    const data = await loadTimelineShare({ actor, target }, params.get("ts") || Date.now().toString());
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/follow-timeline/share");
    return Response.json({ error: "Could not load the latest followers. Please try again." }, { status: 502 });
  }
});

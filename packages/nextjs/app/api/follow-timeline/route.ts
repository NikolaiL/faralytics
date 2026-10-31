import { InputError } from "~~/lib/activity";
import { loadTimeline } from "~~/lib/follow-timeline-data";
import { timelineSelection } from "~~/lib/follow-timeline";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 30;
export const GET = withErrorReporting("/api/follow-timeline", async (request) => {
  try {
    const selection = timelineSelection(request.nextUrl.searchParams);
    const data = await loadTimeline(selection);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/follow-timeline");
    return Response.json(
      { error: "The follow timeline is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
});

import { InputError } from "~~/lib/activity";
import { casterSelection } from "~~/lib/top-casters";
import { loadTopCasters } from "~~/lib/top-casters-data";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";

export const runtime = "nodejs";
export const maxDuration = 45;
export const GET = withErrorReporting("/api/top-casters", async (request) => {
  try {
    return Response.json(await loadTopCasters(casterSelection(request.nextUrl.searchParams)), {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/top-casters");
    return Response.json({ error: "Could not load Top Casters. Please try again." }, { status: 502 });
  }
});

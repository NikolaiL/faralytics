import { InputError } from "~~/lib/activity";
import { loadActivity } from "~~/lib/data";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const GET = withErrorReporting("/api/activity", async (request) => {
  const params = request.nextUrl.searchParams;
  try {
    const data = await loadActivity(
      params.get("user") || "",
      params.get("period") || "365",
      params.get("end") || undefined,
    );
    return Response.json(data, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/activity");
    return Response.json({ error: "Activity is temporarily unavailable. Please try again." }, { status: 502 });
  }
});

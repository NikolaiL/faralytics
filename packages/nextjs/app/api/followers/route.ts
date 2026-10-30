import { InputError } from "~~/lib/activity";
import { loadFollowers } from "~~/lib/follower-data";
import { withErrorReporting, reportServerError } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 60;
export const GET = withErrorReporting("/api/followers", async (request) => {
  const params = request.nextUrl.searchParams;
  try {
    if (params.has("top") && params.get("top") !== "10") throw new InputError("Use Top 10 or choose accounts.");
    const data = await loadFollowers({
      fids: params.get("fids") ?? undefined,
      user: params.get("user") ?? undefined,
      top: params.get("top") === "10",
      end: params.get("end") ?? undefined,
    });
    return Response.json(data, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/followers");
    return Response.json({ error: "Follower history is temporarily unavailable. Please try again." }, { status: 502 });
  }
});

import { InputError } from "~~/lib/activity";
import { resolveAccount } from "~~/lib/data";
import { yearReviewEnd } from "~~/lib/year-review";
import { readYearReview, yearReviewAvailable } from "~~/lib/year-review-data";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";

export const runtime = "nodejs";
export const maxDuration = 45;
export const GET = withErrorReporting("/api/year-in-review", async (request) => {
  if (!yearReviewAvailable()) return Response.json({ error: "Review not found." }, { status: 404 });
  try {
    const params = request.nextUrl.searchParams;
    const end = yearReviewEnd(params.get("end"));
    const fid = await resolveAccount(params.get("user") || "");
    return Response.json(await readYearReview(fid, end), { headers: { "Cache-Control": "private, max-age=120" } });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/year-in-review");
    return Response.json({ error: "Could not load this review. Try again." }, { status: 502 });
  }
});

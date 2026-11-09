import { InputError } from "~~/lib/activity";
import { resolveAccount } from "~~/lib/data";
import { yearReviewEnd, yearReviewPath, yearReviewSections, type YearReviewRating } from "~~/lib/year-review";
import { unlockYearReview, yearReviewAccess } from "~~/lib/year-review-access";
import { readYearReview, readYearReviewRatings } from "~~/lib/year-review-data";
import { protectedYearReviewSharePath } from "~~/lib/year-review-share";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";

export const runtime = "nodejs";
export const maxDuration = 45;
export const POST = withErrorReporting("/api/year-in-review", async (request) => {
  const body = await request.text();
  if (body.length > 2048) return new Response("Request too large.", { status: 413 });
  const form = new URLSearchParams(body);
  const user = form.get("user")?.slice(0, 64);
  const end = form.get("end")?.slice(0, 10);
  const path = user ? yearReviewPath(user, end || undefined) : "/year-in-review";
  const url = new URL(path, request.url);
  if (!(await unlockYearReview(form.get("password") ?? "", url.protocol === "https:"))) {
    url.searchParams.set("error", "password");
  }
  return new Response(null, {
    status: 303,
    headers: { Location: url.pathname + url.search, "Cache-Control": "no-store" },
  });
});

export const GET = withErrorReporting("/api/year-in-review", async (request) => {
  const access = await yearReviewAccess();
  if (access !== "allowed")
    return Response.json({ error: "Review unavailable." }, { status: access === "locked" ? 401 : 404 });
  try {
    const params = request.nextUrl.searchParams;
    const end = yearReviewEnd(params.get("end"));
    const fid = await resolveAccount(params.get("user") || "");
    const [data, ranked] = await Promise.all([
      readYearReview(fid, end),
      readYearReviewRatings(fid, end).catch((error) => {
        reportServerError(error, "/api/year-in-review/ratings");
        return [];
      }),
    ]);
    const stats = yearReviewSections(data)
      .slice(0, 2)
      .flatMap(({ stats }) => stats.slice(0, 4));
    const ratings: Record<string, YearReviewRating> = {};
    for (const row of ranked) {
      const stat = stats[Number(row.metric) - 1];
      if (stat && stat[1] === Number(row.score)) {
        ratings[stat[0]] = {
          rank: Number(row.rank),
          percentile: Number(row.percentile),
          topPercent: Number(row.topPercent),
        };
      }
    }
    return Response.json(
      { ...data, ratings, sharePath: protectedYearReviewSharePath(fid, end) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/year-in-review");
    return Response.json({ error: "Could not load this review. Try again." }, { status: 502 });
  }
});

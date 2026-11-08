import { InputError } from "~~/lib/activity";
import { resolveAccount } from "~~/lib/data";
import { yearReviewEnd, yearReviewPath } from "~~/lib/year-review";
import { unlockYearReview, yearReviewAccess } from "~~/lib/year-review-access";
import { readYearReview } from "~~/lib/year-review-data";
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
    return Response.json(await readYearReview(fid, end), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/year-in-review");
    return Response.json({ error: "Could not load this review. Try again." }, { status: 502 });
  }
});

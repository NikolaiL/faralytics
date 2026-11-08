import { ImageResponse } from "next/og";
import { YearReviewOg } from "~~/components/YearReviewOg";
import { InputError } from "~~/lib/activity";
import { resolveAccount } from "~~/lib/data";
import { OG_FONTS } from "~~/lib/og-fonts";
import { yearReviewEnd } from "~~/lib/year-review";
import { yearReviewAccess, yearReviewIsPublic } from "~~/lib/year-review-access";
import { loadYearReviewAvatars, readYearReview } from "~~/lib/year-review-data";
import { isProtectedYearReviewShare } from "~~/lib/year-review-share";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";

export const runtime = "nodejs";
export const maxDuration = 60;
export const GET = withErrorReporting<{ params: Promise<{ format: string }> }>(
  "/api/og/year-in-review/[format]",
  async (request, context) => {
    const { format } = await context.params;
    if (format !== "farcaster.png" && format !== "x.png") return new Response(null, { status: 404 });
    const access = await yearReviewAccess();
    const params = request.nextUrl.searchParams;
    const user = params.get("user") || "";
    const anchor = params.get("end");
    const shared = !!anchor && isProtectedYearReviewShare(user, anchor, params.get("ts"), params.get("share"));
    if (access !== "allowed" && !shared) return new Response(null, { status: access === "locked" ? 401 : 404 });
    try {
      const end = yearReviewEnd(anchor);
      const fid = shared ? user : await resolveAccount(user);
      const data = await readYearReview(fid, end);
      const avatars = await loadYearReviewAvatars(data);
      const height = format === "x.png" ? 600 : 800;
      return new ImageResponse(<YearReviewOg data={data} avatars={avatars} height={height} />, {
        width: 1200,
        height,
        fonts: OG_FONTS,
        headers: {
          "Cache-Control": shared || yearReviewIsPublic() ? "public, max-age=300, s-maxage=300" : "private, no-store",
        },
      });
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
      reportServerError(error, "/api/og/year-in-review/[format]");
      return Response.json({ error: "Could not generate the recap image." }, { status: 502 });
    }
  },
);

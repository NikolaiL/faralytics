import { ImageResponse } from "next/og";
import { YearReviewOg } from "~~/components/YearReviewOg";
import { InputError } from "~~/lib/activity";
import { loadAvatar } from "~~/lib/avatar";
import { resolveAccount } from "~~/lib/data";
import { OG_FONTS } from "~~/lib/og-fonts";
import { yearReviewEnd } from "~~/lib/year-review";
import { yearReviewAccess, yearReviewIsPublic } from "~~/lib/year-review-access";
import { readYearReview } from "~~/lib/year-review-data";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";

export const runtime = "nodejs";
export const maxDuration = 60;
export const GET = withErrorReporting<{ params: Promise<{ format: string }> }>(
  "/api/og/year-in-review/[format]",
  async (request, context) => {
    const { format } = await context.params;
    if (format !== "farcaster.png" && format !== "x.png") return new Response(null, { status: 404 });
    const access = await yearReviewAccess();
    if (access !== "allowed") return new Response(null, { status: access === "locked" ? 401 : 404 });
    try {
      const params = request.nextUrl.searchParams;
      const end = yearReviewEnd(params.get("end"));
      const fid = await resolveAccount(params.get("user") || "");
      const data = await readYearReview(fid, end);
      const bytes = await loadAvatar(data.profile.pfp_url);
      const avatar = bytes ? `data:image/png;base64,${bytes.toString("base64")}` : null;
      const height = format === "x.png" ? 600 : 800;
      return new ImageResponse(<YearReviewOg data={data} avatar={avatar} height={height} />, {
        width: 1200,
        height,
        fonts: OG_FONTS,
        headers: { "Cache-Control": yearReviewIsPublic() ? "public, max-age=300, s-maxage=300" : "private, no-store" },
      });
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
      reportServerError(error, "/api/og/year-in-review/[format]");
      return Response.json({ error: "Could not generate the recap image." }, { status: 502 });
    }
  },
);

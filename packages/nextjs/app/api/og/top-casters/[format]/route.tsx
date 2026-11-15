import { ImageResponse } from "next/og";
import { prepareTopCastersOg } from "~~/components/TopCastersOg";
import { InputError } from "~~/lib/activity";
import { OG_FONTS } from "~~/lib/og-fonts";
import { casterSelection } from "~~/lib/top-casters";
import { readCasterShare } from "~~/lib/top-caster-shares";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 60;
export const GET = withErrorReporting<{ params: Promise<{ format: string }> }>(
  "/api/og/top-casters/[format]",
  async (request, context) => {
    const { format } = await context.params;
    if (format !== "farcaster.png" && format !== "x.png")
      return new Response("Image format not found", { status: 404 });
    try {
      const selection = casterSelection(request.nextUrl.searchParams);
      const share = request.nextUrl.searchParams.get("share");
      const snapshot = share ? await readCasterShare(share, selection) : undefined;
      const height = format === "x.png" ? 600 : 800;
      return new ImageResponse(await prepareTopCastersOg(snapshot?.selection ?? selection, height, snapshot?.data), {
        width: 1200,
        height,
        fonts: OG_FONTS,
        headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
      });
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
      reportServerError(error, "/api/og/top-casters/[format]");
      return Response.json({ error: "Could not generate the Top Casters image." }, { status: 502 });
    }
  },
);

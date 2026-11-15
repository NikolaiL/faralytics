import { ImageResponse } from "next/og";
import { LiveViewOg } from "~~/components/LiveViewOg";
import { InputError } from "~~/lib/activity";
import { OG_FONTS } from "~~/lib/og-fonts";
import { liveSelection } from "~~/lib/live-view";
import { loadLiveView } from "~~/lib/live-view-data";
import { readLiveShare } from "~~/lib/live-view-shares";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 60;
export const GET = withErrorReporting<{ params: Promise<{ format: string }> }>(
  "/api/og/live-view/[format]",
  async (request, context) => {
    const { format } = await context.params;
    if (format !== "farcaster.png" && format !== "x.png")
      return new Response("Image format not found", { status: 404 });
    try {
      const selection = liveSelection(request.nextUrl.searchParams),
        share = request.nextUrl.searchParams.get("share");
      const snapshot = share
        ? await readLiveShare(share, selection)
        : { ...(await loadLiveView(selection)), type: selection.type };
      const height = format === "x.png" ? 600 : 800;
      return new ImageResponse(<LiveViewOg snapshot={snapshot} height={height} />, {
        width: 1200,
        height,
        fonts: OG_FONTS,
        headers: { "Cache-Control": share ? "public, max-age=31536000, immutable" : "public, max-age=5, s-maxage=5" },
      });
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
      reportServerError(error, "/api/og/live-view/[format]");
      return Response.json({ error: "Could not generate this activity image." }, { status: 502 });
    }
  },
);

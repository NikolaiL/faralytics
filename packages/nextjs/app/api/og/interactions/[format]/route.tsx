import { ImageResponse } from "next/og";
import { InputError } from "~~/lib/activity";
import { resolveAccount } from "~~/lib/data";
import { interactionSelection } from "~~/lib/interaction-ranking";
import { prepareRankingArtwork } from "~~/lib/interaction-ranking-artwork";
import { OG_FONTS } from "~~/lib/og-fonts";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";

export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = withErrorReporting<{ params: Promise<{ format: string }> }>(
  "/api/og/interactions/[format]",
  async (request, context) => {
    const { format } = await context.params;
    if (format !== "farcaster.png" && format !== "x.png")
      return new Response("Image format not found", { status: 404 });
    try {
      const params = request.nextUrl.searchParams;
      const fid = await resolveAccount(params.get("user") || "");
      const { period, metric } = interactionSelection(params.get("period"), params.get("metric"));
      const height = format === "x.png" ? 600 : 800;
      const { artwork } = await prepareRankingArtwork(fid, period, metric, height);
      return new ImageResponse(artwork, {
        width: 1200,
        height,
        fonts: OG_FONTS,
        headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
      });
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
      reportServerError(error, "/api/og/interactions/[format]");
      return Response.json({ error: "Could not generate the interaction rankings image." }, { status: 502 });
    }
  },
);

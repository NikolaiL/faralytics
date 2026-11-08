import { ImageResponse } from "next/og";
import { InputError } from "~~/lib/activity";
import { resolveAccount } from "~~/lib/data";
import { OG_FONTS } from "~~/lib/og-fonts";
import { wordCloudSelection } from "~~/lib/word-cloud";
import { prepareWordCloudArtwork, readWordCloudPng } from "~~/lib/word-cloud-artwork";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";

export const runtime = "nodejs";
export const maxDuration = 30;
export const GET = withErrorReporting<{ params: Promise<{ format: string }> }>(
  "/api/og/word-cloud/[format]",
  async (request, context) => {
    const { format } = await context.params;
    if (!["cloud.png", "farcaster.png", "x.png"].includes(format))
      return new Response("Image format not found", { status: 404 });
    try {
      const params = request.nextUrl.searchParams;
      const fid = await resolveAccount(params.get("user") || "");
      const selection = wordCloudSelection(params.get("period"), params.get("at"));
      const cache = params.has("at") ? "public, max-age=300, s-maxage=300" : "no-store";
      if (format === "cloud.png") {
        const image = await readWordCloudPng(fid, selection);
        return new Response(Uint8Array.from(Buffer.from(image, "base64")), {
          headers: { "Content-Type": "image/png", "Cache-Control": cache },
        });
      }
      const height = format === "x.png" ? 600 : 800;
      const { artwork } = await prepareWordCloudArtwork(fid, selection, height);
      return new ImageResponse(artwork, {
        width: 1200,
        height,
        fonts: OG_FONTS,
        headers: { "Cache-Control": cache },
      });
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
      reportServerError(error, "/api/og/word-cloud/[format]");
      return Response.json({ error: "Could not generate the word cloud image." }, { status: 502 });
    }
  },
);

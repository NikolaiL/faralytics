import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FollowersOg } from "~~/components/FollowersOg";
import { DefaultOg } from "~~/components/DefaultOg";
import { InputError } from "~~/lib/activity";
import { loadFollowers } from "~~/lib/follower-data";
import { loadAvatar } from "~~/lib/avatar";
import { withErrorReporting, reportServerError } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 60;
const fonts = [
  {
    name: "FaralyticsSans",
    data: readFileSync(join(process.cwd(), "assets/fonts/FaralyticsSans-Regular.ttf")),
    weight: 400 as const,
    style: "normal" as const,
  },
  {
    name: "FaralyticsSans",
    data: readFileSync(join(process.cwd(), "assets/fonts/FaralyticsSans-Bold.ttf")),
    weight: 700 as const,
    style: "normal" as const,
  },
];
export const GET = withErrorReporting<{ params: Promise<{ format: string }> }>(
  "/api/og/followers/[format]",
  async (request, context) => {
    const { format } = await context.params;
    if (format !== "farcaster.png" && format !== "x.png")
      return new Response("Image format not found", { status: 404 });
    const p = request.nextUrl.searchParams,
      height = format === "x.png" ? 600 : 800;
    const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    try {
      if (p.has("top") && p.get("top") !== "10") throw new InputError("Use Top 10 or choose accounts.");
      if (!p.has("fids") && !p.has("top"))
        return new ImageResponse(<DefaultOg height={height} generatedAt={generatedAt} />, { width: 1200, height });
      const data = await loadFollowers({
        fids: p.get("fids") ?? undefined,
        top: p.get("top") === "10",
        end: p.get("end") ?? undefined,
      });
      const avatars = await Promise.all(
        data.series.map(async (series) => {
          const bytes = await loadAvatar(series.profile.pfp_url);
          return bytes ? `data:image/png;base64,${bytes.toString("base64")}` : null;
        }),
      );
      return new ImageResponse(
        <FollowersOg data={data} avatars={avatars} height={height} generatedAt={generatedAt} />,
        {
          width: 1200,
          height,
          fonts,
          headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" },
        },
      );
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
      reportServerError(error, "/api/og/followers/[format]");
      return Response.json({ error: "Could not generate the follower image. Please try again." }, { status: 502 });
    }
  },
);

import { ImageResponse } from "next/og";
import { TimelineOg } from "~~/components/TimelineOg";
import { OG_FONTS } from "~~/lib/og-fonts";
import { InputError } from "~~/lib/activity";
import { timelineSelection } from "~~/lib/follow-timeline";
import { loadTimelineShare } from "~~/lib/follow-timeline-data";
import { loadAvatar } from "~~/lib/avatar";
import { withErrorReporting, reportServerError } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 60;
export const GET = withErrorReporting<{ params: Promise<{ format: string }> }>(
  "/api/og/follow-timeline/[format]",
  async (request, context) => {
    const { format } = await context.params;
    if (format !== "farcaster.png" && format !== "x.png")
      return new Response("Image format not found", { status: 404 });
    try {
      const p = request.nextUrl.searchParams;
      const { actor, target } = timelineSelection(p);
      const data = await loadTimelineShare({ actor, target }, p.get("ts") || Date.now().toString());
      const sources = data.events.map((event) => event.actor.pfp_url);
      data.events.forEach((event, index) => {
        sources[10 + index] = event.target.pfp_url;
      });
      sources[20] = data.filters.actor?.pfp_url;
      sources[21] = data.filters.target?.pfp_url;
      const avatars = await Promise.all(
        sources.map(async (source) => {
          const bytes = await loadAvatar(source);
          return bytes ? `data:image/png;base64,${bytes.toString("base64")}` : null;
        }),
      );
      const height = format === "x.png" ? 600 : 800;
      return new ImageResponse(<TimelineOg data={data} avatars={avatars} height={height} />, {
        width: 1200,
        height,
        fonts: OG_FONTS,
        headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
      });
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
      reportServerError(error, "/api/og/follow-timeline/[format]");
      return Response.json({ error: "Could not generate the latest followers image." }, { status: 502 });
    }
  },
);

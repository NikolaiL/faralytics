import { ImageResponse } from "next/og";
import { FriendshipOg } from "~~/components/FriendshipOg";
import { InputError } from "~~/lib/activity";
import { loadAvatar } from "~~/lib/avatar";
import { loadFriendship } from "~~/lib/friendship-data";
import { OG_FONTS } from "~~/lib/og-fonts";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";

export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = withErrorReporting<{ params: Promise<{ format: string }> }>(
  "/api/og/friendship/[format]",
  async (request, context) => {
    const { format } = await context.params;
    if (format !== "farcaster.png" && format !== "x.png")
      return new Response("Image format not found", { status: 404 });
    try {
      const params = new URLSearchParams(request.nextUrl.searchParams);
      params.delete("before");
      const ts = params.get("ts") || Date.now().toString();
      params.set("ts", ts);
      const data = await loadFriendship(params);
      const avatars = await Promise.all(
        data.profiles.map(async (profile) => {
          const bytes = await loadAvatar(profile.pfp_url).catch(() => null);
          return bytes ? `data:image/png;base64,${bytes.toString("base64")}` : null;
        }),
      );
      const height = format === "x.png" ? 600 : 800;
      return new ImageResponse(<FriendshipOg data={data} avatars={avatars} height={height} ts={Number(ts)} />, {
        width: 1200,
        height,
        fonts: OG_FONTS,
        headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
      });
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
      reportServerError(error, "/api/og/friendship/[format]");
      return Response.json({ error: "Could not generate the Friendship image." }, { status: 502 });
    }
  },
);

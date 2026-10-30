import { ComparisonOg } from "~~/components/ComparisonOg";
import { ActivityOg } from "~~/components/ActivityOg";
import { OG_FONTS } from "~~/lib/og-fonts";
import { ImageResponse } from "next/og";
import { DefaultOg } from "~~/components/DefaultOg";
import { InputError, validFid } from "~~/lib/activity";
import { loadAvatar } from "~~/lib/avatar";
import { loadActivity } from "~~/lib/data";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";

export const GET = withErrorReporting<{ params: Promise<{ format: string }> }>(
  "/api/og/[format]",
  async (request, context) => {
    const { format } = await context.params;
    if (format !== "farcaster.png" && format !== "x.png")
      return new Response("Image format not found", { status: 404 });
    const params = request.nextUrl.searchParams;
    try {
      if (!params.has("fid")) {
        const height = format === "x.png" ? 600 : 800;
        const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
        return new ImageResponse(<DefaultOg height={height} generatedAt={generatedAt} />, {
          width: 1200,
          height,
          fonts: OG_FONTS,
          headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" },
        });
      }
      const data = await loadActivity(
        params.get("fid") || "",
        params.get("period") || "365",
        params.get("end") || undefined,
      );
      const compare = params.get("compare");
      if (compare !== null && (!validFid(compare) || compare === data.profile.fid))
        throw new InputError("Choose a different valid FID to compare.");
      const second = compare ? await loadActivity(compare, data.period, data.anchor) : undefined;
      const avatarBytes = await loadAvatar(data.profile.pfp_url);
      const secondAvatarBytes = second ? await loadAvatar(second.profile.pfp_url) : null;
      const avatar = avatarBytes ? `data:image/png;base64,${avatarBytes.toString("base64")}` : null;
      const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
      const height = format === "x.png" ? 600 : 800;
      return new ImageResponse(
        second ? (
          <ComparisonOg
            first={data}
            second={second}
            avatars={[
              avatar,
              secondAvatarBytes ? `data:image/png;base64,${secondAvatarBytes.toString("base64")}` : null,
            ]}
            generatedAt={generatedAt}
            height={height}
          />
        ) : (
          <ActivityOg data={data} avatar={avatar} generatedAt={generatedAt} height={height} />
        ),
        {
          width: 1200,
          height,
          fonts: OG_FONTS,
          headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" },
        },
      );
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
      reportServerError(error, "/api/og/[format]");
      return Response.json({ error: "Could not generate the chart image. Please try again." }, { status: 502 });
    }
  },
);

import { OG_FONTS } from "~~/lib/og-fonts";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { ActivityOg } from "~~/components/ActivityOg";
import { loadActivity } from "~~/lib/data";
import { loadAvatar } from "~~/lib/avatar";
import { InputError, periodLabel, sharePath } from "~~/lib/activity";
import { signNFTPackage } from "~~/lib/nft-auth";
import { contentCID } from "~~/lib/ipfs";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const POST = withErrorReporting("/api/nft/prepare", async (request) => {
  try {
    if (!process.env.PINATA_JWT || !process.env.PINATA_API_SECRET)
      return Response.json({ error: "NFT storage is not configured." }, { status: 503 });
    const text = await request.text();
    if (text.length > 2048) return Response.json({ error: "Request too large." }, { status: 413 });
    const input = JSON.parse(text);
    if (typeof input.user !== "string" || typeof input.period !== "string" || typeof input.end !== "string")
      return Response.json({ error: "Choose an account and period." }, { status: 400 });
    const data = await loadActivity(input.user, input.period, input.end);
    const avatarBytes = await loadAvatar(data.profile.pfp_url);
    const avatar = avatarBytes ? `data:image/png;base64,${avatarBytes.toString("base64")}` : null;
    const capturedAt = new Date().toISOString();
    const response = new ImageResponse(
      <ActivityOg data={data} avatar={avatar} generatedAt={capturedAt.slice(0, 19).replace("T", " ")} height={800} />,
      { width: 1200, height: 800, fonts: OG_FONTS },
    );
    const image = await sharp(Buffer.from(await response.arrayBuffer()))
      .png({ palette: true, colors: 256, effort: 6 })
      .toBuffer();
    if (image.length > 262_144) throw new Error("NFT image exceeds the immutable raw-block size limit.");
    const imageURI = `ipfs://${await contentCID(image)}`;
    const metadataJSON = JSON.stringify({
      name: `Faralytics · @${data.profile.username || data.profile.fid} · ${data.period === "365" ? "365 days" : data.period}`,
      description: `Snapshot of captured Farcaster activity in ${periodLabel(data.period)}. User-submitted artwork; not proof of account ownership or complete history.`,
      image: imageURI,
      external_url: `https://faralytics.vercel.app${sharePath(data.profile.fid, data.period, data.anchor)}`,
      attributes: [
        { trait_type: "FID", value: data.profile.fid },
        { trait_type: "Period", value: data.period },
        { trait_type: "Actions", value: data.total },
        { trait_type: "Active days", value: data.activeDays },
        { trait_type: "Longest streak", value: data.longestStreak },
        { trait_type: "Captured at", value: capturedAt },
      ],
      properties: { activity: data },
    });
    const metadataURI = `ipfs://${await contentCID(Buffer.from(metadataJSON))}`;
    return Response.json(
      {
        signature: signNFTPackage(metadataURI),
        imageURI,
        metadataURI,
        imageBase64: image.toString("base64"),
        metadataJSON,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid request." }, { status: 400 });
    reportServerError(error, "/api/nft/prepare");
    return Response.json({ error: "Could not prepare the NFT image. Please try again." }, { status: 502 });
  }
});

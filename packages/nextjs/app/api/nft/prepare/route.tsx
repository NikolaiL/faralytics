import { YearReviewOg } from "~~/components/YearReviewOg";
import { yearReviewEnd, yearReviewPath, yearReviewSections, yearReviewYear } from "~~/lib/year-review";
import { yearReviewAccess, yearReviewCanMint } from "~~/lib/year-review-access";
import { readYearReview } from "~~/lib/year-review-data";
import { wordCloudPath, wordCloudPeriods, wordCloudSelection } from "~~/lib/word-cloud";
import { prepareWordCloudArtwork } from "~~/lib/word-cloud-artwork";
import { resolveAccount } from "~~/lib/data";
import { interactionMetrics, interactionSelection } from "~~/lib/interaction-ranking";
import { prepareRankingArtwork } from "~~/lib/interaction-ranking-artwork";
import { FollowersOg } from "~~/components/FollowersOg";
import { TimelineOg } from "~~/components/TimelineOg";
import { loadFollowers } from "~~/lib/follower-data";
import { followersPath } from "~~/lib/followers";
import { loadTimeline } from "~~/lib/follow-timeline-data";
import { timelineSharePath } from "~~/lib/timeline-share";
import { OG_FONTS } from "~~/lib/og-fonts";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { FriendshipOg } from "~~/components/FriendshipOg";
import { loadFriendship } from "~~/lib/friendship-data";
import { ActivityOg } from "~~/components/ActivityOg";
import { loadActivity } from "~~/lib/data";
import { loadAvatar } from "~~/lib/avatar";
import { InputError, periodLabel, sharePath } from "~~/lib/activity";
import { signNFTPackage } from "~~/lib/nft-auth";
import { contentCID } from "~~/lib/ipfs";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = withErrorReporting("/api/nft/prepare", async (request) => {
  try {
    const text = await request.text();
    if (text.length > 2048) return Response.json({ error: "Request too large." }, { status: 413 });
    const input = JSON.parse(text);
    const isYearReview = input?.kind === "year-review";
    if (isYearReview) {
      const access = await yearReviewAccess();
      if (access !== "allowed") throw new InputError("Review unavailable.", access === "locked" ? 401 : 404);
    }
    const previewOnly = isYearReview && !yearReviewCanMint();
    if (!previewOnly && (!process.env.PINATA_JWT || !process.env.PINATA_API_SECRET))
      return Response.json({ error: "NFT storage is not configured." }, { status: 503 });
    const { artwork, metadata } = await prepareSnapshot(input);
    const response = new ImageResponse(artwork, { width: 1200, height: 800, fonts: OG_FONTS });
    const image = await sharp(Buffer.from(await response.arrayBuffer()))
      .png({ palette: true, colors: 256, effort: 6 })
      .toBuffer();
    if (image.length > 262_144) throw new Error("NFT image exceeds the immutable raw-block size limit.");
    if (previewOnly)
      return Response.json({ imageBase64: image.toString("base64") }, { headers: { "Cache-Control": "no-store" } });
    const imageURI = `ipfs://${await contentCID(image)}`;
    const metadataJSON = JSON.stringify({ ...metadata, image: imageURI });
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

function prepareSnapshot(input: Record<string, unknown> | null) {
  switch (input?.kind) {
    case "year-review":
      return prepareYearReview(input);
    case "word-cloud":
      return prepareWordCloud(input);
    case "interactions":
      return prepareInteractions(input);
    case "friendship":
      return prepareFriendship(input);
    case "followers":
      return prepareFollowers(input);
    case "follow-timeline":
      return prepareTimeline(input);
    case undefined:
      return prepareActivity(input ?? {});
    default:
      throw new InputError("Choose a supported NFT snapshot.");
  }
}

async function prepareActivity(input: { user?: unknown; period?: unknown; end?: unknown }) {
  if (typeof input?.user !== "string" || typeof input.period !== "string" || typeof input.end !== "string")
    throw new InputError("Choose an account and period.");
  const data = await loadActivity(input.user, input.period, input.end);
  const avatar = await nftAvatar(data.profile.pfp_url);
  const capturedAt = new Date().toISOString();
  return {
    artwork: (
      <ActivityOg data={data} avatar={avatar} generatedAt={capturedAt.slice(0, 19).replace("T", " ")} height={800} />
    ),
    metadata: {
      name: `Faralytics · @${data.profile.username || data.profile.fid} · ${data.period === "365" ? "365 days" : data.period}`,
      description: `Snapshot of captured Farcaster activity in ${periodLabel(data.period)}. User-submitted artwork; not proof of account ownership or complete history.`,
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
    },
  };
}

async function nftAvatar(source?: string | null) {
  const bytes = await loadAvatar(source);
  return bytes ? `data:image/png;base64,${bytes.toString("base64")}` : null;
}

async function prepareFriendship(input: { first?: unknown; second?: unknown; ts?: unknown }) {
  if (
    typeof input.first !== "string" ||
    typeof input.second !== "string" ||
    (input.ts !== undefined && typeof input.ts !== "string")
  )
    throw new InputError("Choose two accounts.");
  const ts = input.ts || Date.now().toString();
  const data = await loadFriendship(new URLSearchParams({ first: input.first, second: input.second, ts }));
  const [first, second] = data.profiles;
  const avatars = await Promise.all(data.profiles.map((profile) => nftAvatar(profile.pfp_url)));
  const capturedAt = new Date(Number(ts)).toISOString();
  const params = new URLSearchParams({ first: first.fid, second: second.fid, ts });
  const total = (period: "all" | "days30" | "days7") =>
    (data.counts[first.fid]?.[period] ?? 0) + (data.counts[second.fid]?.[period] ?? 0);
  return {
    artwork: <FriendshipOg data={data} avatars={avatars} height={800} ts={Number(ts)} />,
    metadata: {
      name: `Faralytics Friendship · @${first.username || first.fid} & @${second.username || second.fid}`,
      description:
        "Snapshot of captured Farcaster interactions between two accounts. This artwork does not verify account ownership or complete history.",
      external_url: `https://faralytics.vercel.app/friendship?${params}`,
      attributes: [
        { trait_type: "Type", value: "Friendship" },
        { trait_type: "First FID", value: first.fid },
        { trait_type: "Second FID", value: second.fid },
        { trait_type: "All-time interactions", value: total("all") },
        { trait_type: "30-day interactions", value: total("days30") },
        { trait_type: "7-day interactions", value: total("days7") },
        { trait_type: "Captured at", value: capturedAt },
      ],
      properties: { friendship: { profiles: data.profiles, counts: data.counts, events: data.events.slice(0, 10) } },
    },
  };
}

async function prepareFollowers(input: { fids?: unknown; end?: unknown }) {
  if (typeof input.fids !== "string" || typeof input.end !== "string")
    throw new InputError("Choose follower accounts and an end date.");
  const data = await loadFollowers({ fids: input.fids, end: input.end });
  const capturedAt = new Date().toISOString();
  const avatars = await Promise.all(data.series.map(({ profile }) => nftAvatar(profile.pfp_url)));
  const accounts = data.series.map(({ profile, followers }) => ({
    fid: profile.fid,
    username: profile.username,
    followers,
  }));
  return {
    artwork: (
      <FollowersOg data={data} avatars={avatars} height={800} generatedAt={capturedAt.slice(0, 19).replace("T", " ")} />
    ),
    metadata: {
      name: "Faralytics · Followers",
      description: "Snapshot of captured Farcaster follower history for the selected accounts.",
      external_url: `https://faralytics.vercel.app${followersPath(data, String(Date.parse(capturedAt)))}`,
      attributes: [
        { trait_type: "Type", value: "Followers" },
        { trait_type: "Accounts", value: accounts.length },
        { trait_type: "Chart end", value: data.anchor },
        { trait_type: "Captured at", value: capturedAt },
      ],
      properties: { followers: { accounts, from: data.from, end: data.anchor } },
    },
  };
}

async function prepareTimeline(input: { actor?: unknown; target?: unknown }) {
  const { actor, target } = input;
  if ((actor !== undefined && typeof actor !== "string") || (target !== undefined && typeof target !== "string"))
    throw new InputError("Choose valid timeline filters.");
  const timeline = await loadTimeline({ actor, target });
  const events = timeline.events.slice(0, 10);
  const generatedAt = new Date().toISOString();
  const data = { filters: timeline.filters, events, generatedAt };
  const sources = Array.from({ length: 22 }, (_, index) =>
    index === 20
      ? data.filters.actor?.pfp_url
      : index === 21
        ? data.filters.target?.pfp_url
        : index < 10
          ? events[index]?.actor.pfp_url
          : events[index - 10]?.target.pfp_url,
  );
  const avatars = await Promise.all(sources.map(nftAvatar));
  return {
    artwork: <TimelineOg data={data} avatars={avatars} height={800} snapshot />,
    metadata: {
      name: "Faralytics · Follow Timeline",
      description: "Snapshot of the latest captured Farcaster follows and unfollows for the selected timeline.",
      external_url: `https://faralytics.vercel.app${timelineSharePath(
        {
          actor: data.filters.actor?.fid,
          target: data.filters.target?.fid,
        },
        String(Date.parse(generatedAt)),
      )}`,
      attributes: [
        { trait_type: "Type", value: "Follow Timeline" },
        { trait_type: "Events", value: events.length },
        { trait_type: "Captured at", value: generatedAt },
      ],
      properties: { timeline: data },
    },
  };
}

async function prepareInteractions(input: { user?: unknown; period?: unknown; metric?: unknown }) {
  const { period, metric } = interactionSelection(input.period, input.metric);
  if (typeof input.user !== "string" || period !== input.period || metric !== input.metric)
    throw new InputError("Choose an account, period, and ranking mode.");
  const fid = await resolveAccount(input.user);
  const { artwork, profile, rows, label } = await prepareRankingArtwork(fid, period, metric, 800);
  const capturedAt = new Date().toISOString();
  const params = new URLSearchParams({ user: fid, period, metric, ts: String(Date.parse(capturedAt)) });
  return {
    artwork,
    metadata: {
      name: `Faralytics Top Interactions · ${profile.username ? "@" + profile.username : "FID " + fid}`,
      description: `Top captured Farcaster interactions ranked by ${interactionMetrics[metric].toLowerCase()} · ${label}.`,
      external_url: `https://faralytics.vercel.app/interactions?${params}`,
      attributes: [
        { trait_type: "Type", value: "Top Interactions" },
        { trait_type: "FID", value: fid },
        { trait_type: "Period", value: label },
        { trait_type: "Ranked by", value: interactionMetrics[metric] },
        { trait_type: "Captured at", value: capturedAt },
      ],
      properties: { interactions: { profile, period, metric, rows } },
    },
  };
}

async function prepareWordCloud(input: { user?: unknown; period?: unknown; at?: unknown }) {
  if (typeof input.user !== "string") throw new InputError("Choose a word cloud account.");
  const selection = wordCloudSelection(input.period, input.at);
  if (selection.period !== input.period || selection.at !== input.at)
    throw new InputError("Choose a valid word cloud period and snapshot time.");
  const fid = await resolveAccount(input.user);
  const { artwork, data, label } = await prepareWordCloudArtwork(fid, selection);
  if (!data.words.length) throw new InputError("This word cloud has no words to mint.");
  return {
    artwork,
    metadata: {
      name: `Faralytics · Word Cloud · ${label}`,
      description: `Most-used words in captured Farcaster casts and replies · ${wordCloudPeriods[selection.period]}.`,
      external_url: `https://faralytics.vercel.app${wordCloudPath(fid, selection)}`,
      attributes: [
        { trait_type: "FID", value: fid },
        { trait_type: "Period", value: wordCloudPeriods[selection.period] },
        { trait_type: "Captured casts with text", value: data.casts },
        { trait_type: "Snapshot through", value: new Date(Number(selection.at) * 1000).toISOString() },
      ],
      properties: { wordCloud: data },
    },
  };
}

async function prepareYearReview(input: { user?: unknown; end?: unknown }) {
  if (typeof input.user !== "string" || typeof input.end !== "string")
    throw new InputError("Choose a Farcaster account and a review date.");
  const end = yearReviewEnd(input.end);
  const fid = await resolveAccount(input.user);
  const data = await readYearReview(fid, end);
  const sections = yearReviewSections(data);
  if (!sections.some((section) => section.stats.some(([, count]) => count > 0)))
    throw new InputError("This account has no captured activity in the selected year.");
  const avatar = await nftAvatar(data.profile.pfp_url);
  const label = data.profile.username ? `@${data.profile.username}` : `FID ${fid}`;
  return {
    artwork: <YearReviewOg data={data} avatar={avatar} />,
    metadata: {
      name: `Faralytics · ${yearReviewYear} in Review · ${label}`,
      description: `Captured Farcaster activity in ${yearReviewYear}, including casts, received engagement, follows and most-used words.`,
      external_url: `https://faralytics.vercel.app${yearReviewPath(fid, end)}`,
      attributes: [
        { trait_type: "FID", value: fid },
        { trait_type: "Year", value: Number(yearReviewYear) },
        ...sections
          .slice(0, 3)
          .flatMap((section) => section.stats.map(([trait_type, value]) => ({ trait_type, value }))),
      ],
      properties: { yearReview: data },
    },
  };
}

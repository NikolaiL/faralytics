import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FollowersExplorer } from "~~/components/FollowersExplorer";
import { getRange, InputError, parseFollowerIds } from "~~/lib/activity";
import { loadFollowers } from "~~/lib/follower-data";
import { followerName, followersPath } from "~~/lib/followers";
const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3100";
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
async function selection(props: Props) {
  const params = await props.searchParams;
  const { fids, top, ts, end } = params;
  try {
    if (fids !== undefined && typeof fids !== "string") notFound();
    if (typeof fids === "string") parseFollowerIds(fids);
    if (top !== undefined && top !== "10") notFound();
    if (top && fids) notFound();
    if (ts !== undefined && (typeof ts !== "string" || !/^\d{1,16}$/.test(ts))) notFound();
    if (end !== undefined && typeof end !== "string") notFound();
    return { fids, top: top === "10", ts, end: getRange("365", end).anchor };
  } catch {
    notFound();
  }
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { fids, top, ts, end } = await selection(props);
  let title = "Followers — Faralytics",
    description = "Compare captured Farcaster follower-action history. From first follow to today.";
  let path = `/followers${ts ? `?ts=${ts}` : ""}`;
  const images = new URLSearchParams();
  if (fids || top) {
    const fallback = new URLSearchParams({ end });
    if (fids) fallback.set("fids", fids);
    else fallback.set("top", "10");
    if (ts) fallback.set("ts", ts);
    path = `/followers?${fallback}`;
    try {
      const data = await loadFollowers({ fids, top, end });
      title = `${data.series.map(followerName).join(data.series.length === 2 ? " vs " : ", ")} — Faralytics followers`;
      path = followersPath(data, ts);
      images.set("fids", data.series.map((s) => s.profile.fid).join(","));
    } catch {
      if (fids) images.set("fids", fids);
      if (top) images.set("top", "10");
    }
    images.set("end", end);
    description = "Captured follows minus unfollows, on a shared time and count scale. Partial historical coverage.";
  }
  if (ts) images.set("ts", ts);
  const url = origin + path,
    image = `${origin}/api/og/followers/farcaster.png?${images}`,
    xImage = `${origin}/api/og/followers/x.png?${images}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: [{ url: image, width: 1200, height: 800, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: xImage, width: 1200, height: 600, alt: title }],
    },
    other: {
      "fc:miniapp": JSON.stringify({
        version: "1",
        imageUrl: image,
        button: {
          title: "Check My Faralytics",
          action: { type: "launch_miniapp", name: "Faralytics", url, splashBackgroundColor: "#0d0b12" },
        },
      }),
    },
  };
}
export default async function FollowersPage(props: Props) {
  const { fids, top, end } = await selection(props);
  let data,
    error = "";
  if (fids || top) {
    try {
      data = await loadFollowers({ fids, top, end });
    } catch (cause) {
      if (cause instanceof InputError) notFound();
      error = "Follower history is temporarily unavailable. Search again or retry Top 10.";
    }
  }
  return <FollowersExplorer initialData={data} initialError={error} initialEnd={end} />;
}

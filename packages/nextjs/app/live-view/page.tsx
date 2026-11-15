import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveView } from "~~/components/LiveView";
import { InputError } from "~~/lib/activity";
import { livePath, liveSelection } from "~~/lib/live-view";
import { readLiveShare } from "~~/lib/live-view-shares";
import { reportServerError } from "~~/utils/reportServerError";
type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
async function selectionFrom(searchParams: PageProps["searchParams"]) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  try {
    return { selection: liveSelection(params), share: params.get("share") || undefined };
  } catch {
    notFound();
  }
}
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { selection, share } = await selectionFrom(searchParams);
  const snapshot = share
    ? await readLiveShare(share, selection).catch((error) => {
        if (error instanceof InputError) notFound();
        reportServerError(error, "/live-view/metadata");
        throw error;
      })
    : undefined;
  const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3100";
  const path = livePath(selection, share),
    url = origin + path,
    params = new URLSearchParams(path.split("?")[1]);
  const title = "Live View — Faralytics";
  const description = snapshot
    ? `Farcaster daily metrics on ${snapshot.date}, as of ${snapshot.totals.asOf.slice(11, 19)} UTC.`
    : "Live captured Farcaster activity and daily active users.";
  const image = `${origin}/api/og/live-view/farcaster.png${params.size ? `?${params}` : ""}`;
  const embed = JSON.stringify({
    version: "1",
    imageUrl: image,
    button: {
      title: "Open Live View",
      action: { type: "launch_miniapp", name: "Faralytics", url, splashBackgroundColor: "#0d0b12" },
    },
  });
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, images: [{ url: image, width: 1200, height: 800 }] },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/api/og/live-view/x.png${params.size ? `?${params}` : ""}`],
    },
    other: { "fc:miniapp": embed, "fc:frame": embed },
  };
}
export default async function LiveViewPage({ searchParams }: PageProps) {
  const { selection } = await selectionFrom(searchParams);
  return <LiveView initialUser={selection.user} initialType={selection.type} initialNow={new Date().toISOString()} />;
}

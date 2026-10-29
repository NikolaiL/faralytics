import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivityExplorer } from "~~/components/ActivityExplorer";
import { getRange, InputError, periodLabel, sharePath, validFid } from "~~/lib/activity";
import { loadActivity } from "~~/lib/data";

type Props = { params: Promise<{ fid: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
async function selection(props: Props) {
  const { fid } = await props.params;
  const params = await props.searchParams;
  if (!validFid(fid)) notFound();
  const period = typeof params.period === "string" ? params.period : "365";
  const ts = params.ts;
  if (ts !== undefined && (typeof ts !== "string" || !/^\d{1,16}$/.test(ts))) notFound();
  try {
    return { fid, period, ts, ...getRange(period, typeof params.end === "string" ? params.end : undefined) };
  } catch {
    notFound();
  }
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { fid, period, anchor, ts } = await selection(props);
  const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3100";
  const url = `${origin}${sharePath(fid, period, anchor, ts)}`;
  const imageParams = new URLSearchParams({ fid, period, end: anchor });
  if (ts) imageParams.set("ts", ts);
  const image = `${origin}/api/og/farcaster.png?${imageParams}`;
  const xImage = `${origin}/api/og/x.png?${imageParams}`;
  let title = `FID ${fid} — Faralytics`;
  let description = `Captured Farcaster activity in ${periodLabel(period)}. Your year, one purple square at a time.`;
  try {
    const data = await loadActivity(fid, period, anchor);
    title = `${data.profile.username ? `@${data.profile.username}` : `FID ${fid}`} — Faralytics`;
    description = `${data.total.toLocaleString("en-US")} captured actions in ${periodLabel(period)}. ${data.activeDays} active days. Historical coverage is incomplete.`;
  } catch {
    /* The page exposes a retry if the database is temporarily unavailable. */
  }
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
          title: "Explore activity",
          action: { type: "launch_miniapp", name: "Faralytics", url, splashBackgroundColor: "#0d0b12" },
        },
      }),
    },
  };
}
export default async function SharePage(props: Props) {
  const { fid, period, anchor } = await selection(props);
  let data;
  try {
    data = await loadActivity(fid, period, anchor);
  } catch (error) {
    if (error instanceof InputError) notFound();
    throw error;
  }
  return <ActivityExplorer initialData={data} initialUser={fid} />;
}

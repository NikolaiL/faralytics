import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopCastersExplorer } from "~~/components/TopCastersExplorer";
import { casterMetrics, casterPath, casterPeriods, casterSelection } from "~~/lib/top-casters";
import { loadTopCasters } from "~~/lib/top-casters-data";
import { reportServerError } from "~~/utils/reportServerError";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
async function selectionFrom(searchParams: PageProps["searchParams"]) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  try {
    return { selection: casterSelection(params), ts: params.get("ts") || undefined };
  } catch {
    notFound();
  }
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { selection, ts } = await selectionFrom(searchParams);
  const title = `Top casters · ${casterMetrics[selection.metric || "casts"]} · ${casterPeriods[selection.period]} — Faralytics`;
  const description = `Captured Farcaster activity rankings through ${selection.end} UTC${selection.user ? `, including FID ${selection.user}’s position` : ""}.`;
  const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3100";
  const path = casterPath(selection, ts);
  const url = `${origin}${path}`;
  const image = `${origin}/api/og/top-casters/farcaster.png?${path.split("?")[1]}`;
  const embed = JSON.stringify({
    version: "1",
    imageUrl: image,
    button: {
      title: "View Top Casters",
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
      images: [`${origin}/api/og/top-casters/x.png?${path.split("?")[1]}`],
    },
    other: { "fc:miniapp": embed, "fc:frame": embed },
  };
}

export default async function TopCastersPage({ searchParams }: PageProps) {
  const { selection } = await selectionFrom(searchParams);
  let data;
  let errorMessage;
  try {
    data = await loadTopCasters(selection);
  } catch (error) {
    reportServerError(error, "/top-casters");
    errorMessage = "Could not load Top Casters. Please try again.";
  }
  return (
    <TopCastersExplorer
      key={casterPath(selection)}
      selection={selection}
      initialData={data}
      initialError={errorMessage}
    />
  );
}

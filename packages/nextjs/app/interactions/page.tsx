import type { Metadata } from "next";
import { InteractionExplorer } from "~~/components/InteractionExplorer";
import { friendshipPeriods } from "~~/lib/friendship";
import { interactionMetrics, interactionSelection } from "~~/lib/interaction-ranking";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const title = "Top interactions — Faralytics";
const description = "See who interacts most with a Farcaster account.";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { user, period, metric, ts } = await searchParams;
  if (typeof user !== "string" || !user || user.length > 64) return { title, description };
  const selection = interactionSelection(period, metric);
  const label = friendshipPeriods.find(([key]) => key === selection.period)?.[1];
  const shareTitle = `Top interactions · ${interactionMetrics[selection.metric]} · ${label}`;
  const params = new URLSearchParams({ user, ...selection });
  if (typeof ts === "string" && /^\d{13}$/.test(ts)) params.set("ts", ts);
  const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3100";
  const url = `${origin}/interactions?${params}`;
  const image = `${origin}/api/og/interactions/farcaster.png?${params}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: shareTitle, description, url, images: [{ url: image, width: 1200, height: 800 }] },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [`${origin}/api/og/interactions/x.png?${params}`],
    },
    other: {
      "fc:miniapp": JSON.stringify({
        version: "1",
        imageUrl: image,
        button: {
          title: "View Top Interactions",
          action: { type: "launch_miniapp", name: "Faralytics", url, splashBackgroundColor: "#0d0b12" },
        },
      }),
    },
  };
}

export default async function InteractionsPage({ searchParams }: PageProps) {
  const { user, period, metric } = await searchParams;
  const selection = interactionSelection(period, metric);
  return (
    <InteractionExplorer
      key={JSON.stringify([user, selection])}
      initialUser={typeof user === "string" ? user.slice(0, 64) : ""}
      initialSelection={selection}
    />
  );
}

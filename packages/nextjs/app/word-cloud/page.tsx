import type { Metadata } from "next";
import { WordCloudExplorer } from "~~/components/WordCloudExplorer";
import { globalWordCloudSelection, wordCloudPath, wordCloudPeriods, wordCloudSelection } from "~~/lib/word-cloud";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const title = "Word Cloud — Faralytics";
const description = "Discover the words a Farcaster account uses most often.";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { user, period, at, ts } = await searchParams;
  if (typeof user !== "string" || !/^@?[a-z0-9][a-z0-9.-]{0,62}$/i.test(user)) return { title, description };
  const selection = wordCloudSelection(period, at);
  const shareTitle = `Farcaster Word Cloud · ${wordCloudPeriods[selection.period]}`;
  const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3100";
  const path = wordCloudPath(user, selection, typeof ts === "string" ? ts : undefined);
  const url = new URL(path, origin).toString();
  const params = new URL(url).search;
  const image = new URL(`/api/og/word-cloud/farcaster.png${params}`, origin).toString();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: shareTitle, description, url, images: [{ url: image, width: 1200, height: 800 }] },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [new URL(`/api/og/word-cloud/x.png${params}`, origin).toString()],
    },
    other: {
      "fc:miniapp": JSON.stringify({
        version: "1",
        imageUrl: image,
        button: {
          title: "Check My Word Cloud",
          action: {
            type: "launch_miniapp",
            name: "Faralytics",
            url,
            splashBackgroundColor: "#0d0b12",
          },
        },
      }),
    },
  };
}

export default async function WordCloudPage({ searchParams }: PageProps) {
  const { user, period, at } = await searchParams;
  const initialUser = typeof user === "string" ? user.slice(0, 64) : "";
  return (
    <WordCloudExplorer
      key={JSON.stringify([user, period, at])}
      initialUser={initialUser}
      initialSelection={wordCloudSelection(initialUser ? period : undefined, at)}
      initialGlobalPeriod={globalWordCloudSelection(initialUser ? undefined : period).period}
    />
  );
}

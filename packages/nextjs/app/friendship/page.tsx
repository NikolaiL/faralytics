import type { Metadata } from "next";
import { Friendship } from "~~/components/Friendship";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const title = "Friendship — Faralytics";
const description = "Explore captured Farcaster interactions between two accounts.";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { first, second, ts } = await searchParams;
  if (typeof first !== "string" || typeof second !== "string" || !first || !second) return { title, description };
  const params = new URLSearchParams({ first, second });
  if (typeof ts === "string") params.set("ts", ts);
  const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3100";
  const url = `${origin}/friendship?${params}`;
  const image = `${origin}/api/og/friendship/farcaster.png?${params}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, images: [{ url: image, width: 1200, height: 800 }] },
    twitter: { card: "summary_large_image", images: [`${origin}/api/og/friendship/x.png?${params}`] },
    other: {
      "fc:miniapp": JSON.stringify({
        version: "1",
        imageUrl: image,
        button: {
          title: "Explore Friendship",
          action: { type: "launch_miniapp", name: "Faralytics", url, splashBackgroundColor: "#0d0b12" },
        },
      }),
    },
  };
}

export default async function FriendshipPage({ searchParams }: PageProps) {
  const { first, second, ts } = await searchParams;
  return (
    <Friendship
      initialFirst={typeof first === "string" ? first.slice(0, 64) : ""}
      initialSecond={typeof second === "string" ? second.slice(0, 64) : ""}
      initialTs={typeof ts === "string" && /^\d{13}$/.test(ts) ? ts : ""}
    />
  );
}

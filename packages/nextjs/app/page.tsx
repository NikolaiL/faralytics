import type { Metadata } from "next";
import { ActivityExplorer } from "~~/components/ActivityExplorer";
const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3100";
export const metadata: Metadata = {
  alternates: { canonical: `${origin}/` },
  openGraph: {
    url: `${origin}/`,
    title: "Faralytics",
    description: "Your year, one purple square at a time.",
    images: [{ url: `${origin}/og/faralytics-farcaster-v10.png`, width: 1200, height: 800 }],
  },
  twitter: { card: "summary_large_image", images: [`${origin}/og/faralytics-x-v10.png`] },
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: `${origin}/og/faralytics-farcaster-v10.png`,
      button: {
        title: "Explore activity",
        action: { type: "launch_miniapp", name: "Faralytics", url: `${origin}/`, splashBackgroundColor: "#0d0b12" },
      },
    }),
  },
};
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <ActivityExplorer
      initialUser={typeof params.user === "string" ? params.user : undefined}
      initialPeriod={typeof params.period === "string" ? params.period : undefined}
      initialEnd={typeof params.end === "string" ? params.end : undefined}
    />
  );
}

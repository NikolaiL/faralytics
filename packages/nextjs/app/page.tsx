import type { Metadata } from "next";
import { ActivityExplorer } from "~~/components/ActivityExplorer";
const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3100";
export const metadata: Metadata = {
  alternates: { canonical: `${origin}/` },
  openGraph: {
    url: `${origin}/`,
    title: "Faralytics",
    description: "Your year, one purple square at a time.",
    images: [{ url: `${origin}/og/faralytics-farcaster-v13.png`, width: 1200, height: 800 }],
  },
  twitter: { card: "summary_large_image", images: [`${origin}/og/faralytics-x-v13.png`] },
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: `${origin}/og/faralytics-farcaster-v13.png`,
      button: {
        title: "Check My Faralytics",
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
      initialCompareUser={typeof params.compare === "string" ? params.compare : undefined}
      initialUser={typeof params.user === "string" ? params.user : undefined}
      initialPeriod={typeof params.period === "string" ? params.period : undefined}
      initialEnd={typeof params.end === "string" ? params.end : undefined}
    />
  );
}

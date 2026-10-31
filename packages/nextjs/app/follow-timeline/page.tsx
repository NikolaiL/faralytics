import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FollowTimeline } from "~~/components/FollowTimeline";
import { timelineSelection, validateTimelineShareTime } from "~~/lib/follow-timeline";
const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3100";
const timelineMetadata: Metadata = {
  title: "Follow timeline — Faralytics",
  description:
    "Live captured Farcaster follows and unfollows. Filter by actor, target, or explore everyone's activity.",
};
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const images = new URLSearchParams();
  const page = new URLSearchParams();
  for (const key of ["actor", "target", "ts", "all"] as const) {
    if (typeof params[key] === "string") page.set(key, params[key]);
  }
  for (const key of ["actor", "target"] as const) if (typeof params[key] === "string") images.set(key, params[key]);
  if (typeof params.ts === "string") images.set("ts", params.ts);
  const url = `${origin}/follow-timeline${page.size ? `?${page}` : ""}`;
  const image = `${origin}/api/og/follow-timeline/farcaster.png?${images}`;
  const xImage = `${origin}/api/og/follow-timeline/x.png?${images}`;
  return {
    ...timelineMetadata,
    openGraph: {
      title: "Latest followers — Faralytics",
      description: "A thank-you to the latest captured Farcaster followers.",
      url,
      type: "website",
      images: [{ url: image, width: 1200, height: 800 }],
    },
    twitter: { card: "summary_large_image", images: [xImage] },
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
export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let selection;
  try {
    if (Array.isArray(params.actor) || Array.isArray(params.target) || Array.isArray(params.ts)) notFound();
    if (params.all !== undefined && params.all !== "1") notFound();
    if (params.ts) validateTimelineShareTime(params.ts);
    selection = timelineSelection(
      new URLSearchParams({
        ...(params.actor ? { actor: params.actor } : {}),
        ...(params.target ? { target: params.target } : {}),
      }),
    );
  } catch {
    notFound();
  }
  return (
    <FollowTimeline
      initialActor={selection.actor || ""}
      initialTarget={selection.target || ""}
      initialGlobal={params.all === "1" && !selection.actor && !selection.target}
    />
  );
}

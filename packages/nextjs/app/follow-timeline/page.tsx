import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FollowTimeline } from "~~/components/FollowTimeline";
import { timelineSelection } from "~~/lib/follow-timeline";
export const metadata: Metadata = {
  title: "Follow timeline — Faralytics",
  description:
    "Live captured Farcaster follows and unfollows. Filter by actor, target, or explore everyone's activity.",
};
export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let selection;
  try {
    if (Array.isArray(params.actor) || Array.isArray(params.target)) notFound();
    selection = timelineSelection(
      new URLSearchParams({
        ...(params.actor ? { actor: params.actor } : {}),
        ...(params.target ? { target: params.target } : {}),
      }),
    );
  } catch {
    notFound();
  }
  return <FollowTimeline initialActor={selection.actor || ""} initialTarget={selection.target || ""} />;
}

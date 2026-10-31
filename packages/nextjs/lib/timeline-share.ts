import type { Profile } from "./activity.ts";
import type { TimelineEvent } from "./follow-timeline.ts";
import { formatShareText, shareCredit, type ShareTarget } from "./share-credit.ts";

export type TimelineShareData = {
  filters: { actor: Profile | null; target: Profile | null };
  events: TimelineEvent[];
  generatedAt: string;
};
export function timelineSharePath(selection: { actor?: string; target?: string }, ts: string) {
  const params = new URLSearchParams({ ts });
  if (selection.actor) params.set("actor", selection.actor);
  if (selection.target) params.set("target", selection.target);
  if (!selection.actor && !selection.target) params.set("all", "1");
  return `/follow-timeline?${params}`;
}
export function timelineShareText(data: TimelineShareData, target: ShareTarget, viewerFid?: string) {
  const names = [
    ...new Set(data.events.slice(0, 5).flatMap((event) => (event.actor.username ? [`@${event.actor.username}`] : []))),
  ];
  const profile = !data.filters.actor ? data.filters.target : null;
  const text = profile
    ? profile.fid === viewerFid && names.length
      ? target === "x"
        ? "Thanks to my latest Farcaster followers."
        : `Thanks to my latest followers: ${names.join(" ")}`
      : `Latest followers of ${profile.username ? `@${profile.username}` : `FID ${profile.fid}`}`
    : data.filters.actor
      ? "Explore the latest Farcaster followings with Faralytics."
      : "Explore the latest Farcaster follows and unfollows with Faralytics.";
  return formatShareText(`${text}\n\nCheck Yours\n\n${shareCredit(target)}`, target);
}

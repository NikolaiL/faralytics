import { dateKey, InputError, utcDate, type Profile } from "./activity.ts";
import { formatShareText, shareCredit, type ShareTarget } from "./share-credit.ts";

export const yearReviewYear = "2026";
export const yearReviewStart = `${yearReviewYear}-01-01`;
export const yearReviewMutualTitle = "The Magnificent Seven";
export type YearReview = {
  profile: Profile;
  end: string;
  activity: {
    casts: number;
    replies: number;
    recasts: number;
    likes: number;
    activeDays: number;
    longestStreak: number;
  };
  received: { replies: number; recasts: number; likes: number; people: number };
  topPost: { hash: string; url: string; text: string; postedAt: string | null; interactions: number } | null;
  mutual: { profile: Profile; sent: number; received: number; mutual: number }[];
  follows: { followed: number; unfollowed: number; followedYou: number; unfollowedYou: number };
  words: [string, number][];
  coverage: string;
};

export function yearReviewEnd(input: unknown, now = new Date()) {
  const yesterday = dateKey(new Date(now.getTime() - 86_400_000));
  const limit = yesterday < `${yearReviewYear}-12-31` ? yesterday : `${yearReviewYear}-12-31`;
  const end = input ?? limit;
  if (
    typeof end !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    !Number.isFinite(utcDate(end).getTime()) ||
    dateKey(utcDate(end)) !== end ||
    end < yearReviewStart ||
    end > limit
  )
    throw new InputError("Choose a completed UTC day in 2026.");
  return end;
}

export function yearReviewPath(user: string, end?: string, ts?: string, share?: string) {
  return `/year-in-review?${new URLSearchParams({ user, ...(end ? { end } : {}), ...(ts ? { ts } : {}), ...(share ? { share } : {}) })}`;
}

const postTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatYearReviewPostTime(postedAt: string) {
  return `${postTime.format(new Date(postedAt))} UTC`;
}

export function yearReviewShareText(
  data: Pick<YearReview, "profile" | "mutual">,
  target: Exclude<ShareTarget, "copy">,
  viewerFid?: string,
) {
  const own = viewerFid === data.profile.fid;
  const name = data.profile.username ? `@${data.profile.username}` : `FID ${data.profile.fid}`;
  const heading = `${own ? "My" : `${name}’s`} ${yearReviewYear} on Farcaster. ✦`;
  const credit = shareCredit(target);
  const tags: string[] = [];
  if (own && target === "farcaster") {
    const encoder = new TextEncoder();
    for (const { profile } of data.mutual.slice(0, 7)) {
      if (!profile.username || !/^[a-z0-9][a-z0-9.-]{0,62}$/i.test(profile.username)) continue;
      const tag = `@${profile.username}`;
      if (encoder.encode(`${heading}\n\nMy Magnificent Seven\n${[...tags, tag].join(" ")}\n\n${credit}`).length > 320)
        break;
      tags.push(tag);
    }
  }
  const mentionLine = tags.length ? `\n\nMy Magnificent Seven\n${tags.join(" ")}` : "";
  return formatShareText(`${heading}${mentionLine}\n\n${credit}`, target);
}

export function yearReviewSections(data: YearReview) {
  return [
    {
      title: "What you did",
      description: "Your captured actions, from original casts to the likes you sent.",
      stats: [
        ["Original casts", data.activity.casts],
        ["Replies sent", data.activity.replies],
        ["Recasts sent", data.activity.recasts],
        ["Likes sent", data.activity.likes],
        ["Active days", data.activity.activeDays],
        ["Longest streak", data.activity.longestStreak],
      ] as [string, number][],
    },
    {
      title: "How people responded",
      description: "Interactions received this year on original casts you published this year.",
      post: data.topPost,
      stats: [
        ["Replies received", data.received.replies],
        ["Recasts received", data.received.recasts],
        ["Likes received", data.received.likes],
        ["Distinct people", data.received.people],
      ] as [string, number][],
    },
    {
      title: "Who connected",
      description: "Distinct accounts per action. The same person can appear in both a follow and an unfollow count.",
      stats: [
        ["People you followed", data.follows.followed],
        ["People you unfollowed", data.follows.unfollowed],
        ["People who followed you", data.follows.followedYou],
        ["People who unfollowed you", data.follows.unfollowedYou],
      ] as [string, number][],
    },
    {
      title: "Your words",
      description:
        "Most-used words in your captured casts and replies, after filtering common words and merging plurals.",
      stats: data.words,
    },
    {
      title: yearReviewMutualTitle,
      description: "Your most two-way connections, ranked by the smaller of interactions sent and received.",
      stats: [],
      people: data.mutual,
    },
  ];
}

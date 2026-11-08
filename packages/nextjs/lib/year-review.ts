import { dateKey, InputError, utcDate, type Profile } from "./activity.ts";

export const yearReviewYear = "2026";
export const yearReviewStart = `${yearReviewYear}-01-01`;
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

export function yearReviewPath(user: string, end?: string, ts?: string) {
  return `/year-in-review?${new URLSearchParams({ user, ...(end ? { end } : {}), ...(ts ? { ts } : {}) })}`;
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
  ];
}

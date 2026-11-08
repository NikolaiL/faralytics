import "server-only";
import { unstable_cache } from "next/cache";
import { fillDays, summarize, utcDate } from "~~/lib/activity";
import { query } from "~~/lib/clickhouse";
import { loadProfiles } from "~~/lib/profile-data";
import { readWordCounts } from "~~/lib/word-cloud-data";
import { farcasterEpoch } from "~~/lib/word-cloud";
import { yearReviewStart, type YearReview } from "~~/lib/year-review";
import { yearReviewFollowsSql, yearReviewOutgoingSql, yearReviewReceivedSql } from "~~/lib/year-review-queries";

export function yearReviewPublished() {
  return process.env.YEAR_REVIEW_ENABLED === "1";
}
export function yearReviewAvailable() {
  return (!process.env.VERCEL && !process.env.VERCEL_ENV) || yearReviewPublished();
}

type Counts = { casts: number; replies: number; recasts: number; likes: number };

export const readYearReview = unstable_cache(
  async (fid: string, end: string): Promise<YearReview> => {
    const params = { fid, start: yearReviewStart, end };
    const startSecond = utcDate(yearReviewStart).getTime() / 1000 - farcasterEpoch;
    const lastSecond = utcDate(end).getTime() / 1000 - farcasterEpoch + 86399;
    const [sent, [received], follows, [words], [profile], [status]] = await Promise.all([
      query<Counts & { day: string; actions: number }>(yearReviewOutgoingSql, params),
      query<YearReview["received"]>(yearReviewReceivedSql, params, { timeoutMs: 35000 }),
      query<{ direction: "in" | "out"; follows: number; unfollows: number }>(yearReviewFollowsSql, params),
      readWordCounts(fid, startSecond, [lastSecond]),
      loadProfiles([fid], 4000).catch(() => [{ fid, username: null, display_name: null }]),
      query<{ coverage: string }>(
        "SELECT coverage FROM farcaster.dataset_status LIMIT 1",
        {},
        { timeoutMs: 4000 },
      ).catch(() => []),
    ]);
    const count = (field: keyof Counts) => sent.reduce((sum, row) => sum + Number(row[field]), 0);
    const { activeDays, longestStreak } = summarize(
      fillDays(
        sent.map(({ day, actions }) => ({ day, actions: Number(actions) })),
        yearReviewStart,
        end,
        end,
      ),
    );
    const incoming = follows.find(({ direction }) => direction === "in");
    const outgoing = follows.find(({ direction }) => direction === "out");
    return {
      profile,
      end,
      activity: {
        casts: count("casts"),
        replies: count("replies"),
        recasts: count("recasts"),
        likes: count("likes"),
        activeDays,
        longestStreak,
      },
      received: {
        replies: Number(received.replies),
        likes: Number(received.likes),
        recasts: Number(received.recasts),
        people: Number(received.people),
      },
      follows: {
        followed: Number(outgoing?.follows ?? 0),
        unfollowed: Number(outgoing?.unfollows ?? 0),
        followedYou: Number(incoming?.follows ?? 0),
        unfollowedYou: Number(incoming?.unfollows ?? 0),
      },
      words: words.words.slice(0, 5),
      coverage: status?.coverage ?? "Older pruned or deleted actions may be unavailable.",
    };
  },
  ["year-review-2026-v1"],
  { revalidate: 900 },
);

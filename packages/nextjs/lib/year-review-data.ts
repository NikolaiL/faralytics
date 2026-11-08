import "server-only";
import { unstable_cache } from "next/cache";
import { fillDays, summarize, utcDate } from "~~/lib/activity";
import { loadAvatar } from "~~/lib/avatar";
import { query } from "~~/lib/clickhouse";
import { loadProfiles } from "~~/lib/profile-data";
import { readWordCounts } from "~~/lib/word-cloud-data";
import { farcasterEpoch } from "~~/lib/word-cloud";
import { yearReviewStart, type YearReview } from "~~/lib/year-review";
import {
  yearReviewFollowsSql,
  yearReviewMutualSql,
  yearReviewOutgoingSql,
  yearReviewPostSql,
  yearReviewReceivedSql,
} from "~~/lib/year-review-queries";

type Counts = { casts: number; replies: number; recasts: number; likes: number };
type Received = YearReview["received"] & { cast_hash: string; all_casts: number };
type Mutual = { fid: string; sent: number; received: number; mutual: number };

export function loadYearReviewAvatars(data: YearReview) {
  return Promise.all(
    [data.profile, ...data.mutual.map(({ profile }) => profile)].map(async ({ pfp_url }) => {
      const bytes = await loadAvatar(pfp_url);
      return bytes ? `data:image/png;base64,${bytes.toString("base64")}` : null;
    }),
  );
}

export const readYearReview = unstable_cache(
  async (fid: string, end: string): Promise<YearReview> => {
    const params = { fid, start: yearReviewStart, end };
    const startSecond = utcDate(yearReviewStart).getTime() / 1000 - farcasterEpoch;
    const lastSecond = utcDate(end).getTime() / 1000 - farcasterEpoch + 86399;
    const [sent, receivedRows, follows, [words], [profile], [status], peers] = await Promise.all([
      query<Counts & { day: string; actions: number }>(yearReviewOutgoingSql, params),
      query<Received>(yearReviewReceivedSql, params, { timeoutMs: 35000 }),
      query<{ direction: "in" | "out"; follows: number; unfollows: number }>(yearReviewFollowsSql, params),
      readWordCounts(fid, startSecond, [lastSecond]),
      loadProfiles([fid], 10000).catch(() => [{ fid, username: null, display_name: null }]),
      query<{ coverage: string }>(
        "SELECT coverage FROM farcaster.dataset_status LIMIT 1",
        {},
        { timeoutMs: 4000 },
      ).catch(() => []),
      query<Mutual>(yearReviewMutualSql, params, { timeoutMs: 30000 }),
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
    const received = receivedRows.find((row) => Number(row.all_casts) === 1);
    const top = receivedRows.find((row) => Number(row.all_casts) === 0);
    const topHash = top && /^[0-9a-f]{40}$/i.test(top.cast_hash) ? top.cast_hash : null;
    const [peerProfiles, [cast]] = await Promise.all([
      loadProfiles(
        peers.map(({ fid }) => fid),
        6000,
      ).catch(() => []),
      topHash
        ? query<{ text: string; timestamp: number }>(
            yearReviewPostSql,
            { fid, hash: topHash },
            { timeoutMs: 4000 },
          ).catch(() => [])
        : [],
    ]);
    const profilesByFid = new Map(peerProfiles.map((item) => [item.fid, item]));
    let topPost: YearReview["topPost"] = null;
    if (top && topHash) {
      const hash = `0x${topHash}`;
      topPost = {
        hash,
        url: `https://farcaster.xyz/~/conversations/${hash}`,
        text: cast?.text.trim() ?? "",
        postedAt: cast ? new Date((Number(cast.timestamp) + farcasterEpoch) * 1000).toISOString() : null,
        interactions: Number(top.replies) + Number(top.likes) + Number(top.recasts),
      };
    }
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
        replies: Number(received?.replies ?? 0),
        likes: Number(received?.likes ?? 0),
        recasts: Number(received?.recasts ?? 0),
        people: Number(received?.people ?? 0),
      },
      topPost,
      mutual: peers.map((peer) => ({
        profile: profilesByFid.get(peer.fid) ?? { fid: peer.fid, username: null, display_name: null },
        sent: Number(peer.sent),
        received: Number(peer.received),
        mutual: Number(peer.mutual),
      })),
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
  ["year-review-2026-v4"],
  { revalidate: 900 },
);

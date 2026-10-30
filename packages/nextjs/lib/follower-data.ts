import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { dateKey, getRange, InputError, parseFollowerIds, type Profile } from "./activity";
import { query } from "./clickhouse";
import { resolveAccount } from "./data";
import type { FollowerChartData } from "./followers";

const topFollowerIds = cache(
  unstable_cache(
    async () => {
      const rows = await query<{ fid: string }>(
        "SELECT toString(c.fid) AS fid FROM farcaster.follower_counts AS c WHERE c.fid > 0 ORDER BY c.followers DESC, c.fid ASC LIMIT 10",
      );
      return rows.map((row) => row.fid);
    },
    ["follower-top10-v1"],
    { revalidate: 300 },
  ),
);

const chartData = cache(
  unstable_cache(
    async (selection: string, anchor: string): Promise<FollowerChartData> => {
      const fids = selection.split(","),
        params = { fids: `[${fids.join(",")}]` };
      const until =
        anchor === dateKey(new Date()) ? new Date().toISOString().slice(0, 19).replace("T", " ") : `${anchor} 23:59:59`;
      const [profiles, counts, starts] = await Promise.all([
        query<Profile>(
          "SELECT toString(fid) AS fid, username, display_name, avatar_url AS pfp_url FROM farcaster.profiles WHERE fid IN {fids:Array(UInt64)}",
          params,
        ),
        query<{ fid: string; followers: string | number; refreshed_at: string }>(
          "SELECT toString(fid) AS fid, followers, refreshed_at FROM farcaster.follower_counts WHERE fid IN {fids:Array(UInt64)}",
          params,
        ),
        query<{ fid: string; first_follow: string }>(
          "SELECT toString(recipient_fid) AS fid, min(timestamp) AS first_follow FROM snapchain.received_actions FINAL PREWHERE recipient_fid IN {fids:Array(UInt64)} WHERE action_type = 'follow' AND timestamp <= {until:DateTime} GROUP BY recipient_fid",
          { ...params, until },
        ),
      ]);
      const from = starts.map((row) => row.first_follow).sort()[0] || null;
      const rows = from
        ? await query<{ fid: string; ts: string | number; captured_net_actions: string | number }>(
            "SELECT toString(fid) AS fid, ts, captured_net_actions FROM farcaster.follower_action_chart(fids={fids:Array(UInt64)},from_time={from:DateTime},until_time={until:DateTime})",
            { ...params, from, until },
          )
        : [];
      return {
        from,
        until,
        anchor,
        updatedAt: new Date().toISOString(),
        countsUpdatedAt: counts.map((c) => c.refreshed_at).sort()[0] || null,
        series: fids.map((fid) => {
          const firstFollow = starts.find((row) => row.fid === fid)?.first_follow || null;
          const count = counts.find((row) => row.fid === fid);
          return {
            profile: profiles.find((p) => p.fid === fid) || { fid, username: null, display_name: null },
            followers: count ? Number(count.followers) : null,
            firstFollow,
            points: firstFollow
              ? rows
                  .filter((row) => row.fid === fid)
                  .map((row) => ({ ts: Number(row.ts), value: Number(row.captured_net_actions) }))
              : [],
          };
        }),
      };
    },
    ["follower-chart-v1"],
    { revalidate: 300 },
  ),
);

export async function loadFollowers({
  fids,
  user,
  top,
  end,
}: {
  fids?: string;
  user?: string;
  top?: boolean;
  end?: string;
}): Promise<FollowerChartData> {
  if (top && (fids || user)) throw new InputError("Choose accounts or Top 10, rather than both.");
  const anchor = getRange("365", end).anchor;
  const ids = fids !== undefined ? parseFollowerIds(fids) : [];
  if (user !== undefined) {
    if (ids.length >= 10) throw new InputError("Remove an account before adding another. The maximum is ten.");
    const fid = await resolveAccount(user);
    if (!ids.includes(fid)) ids.push(fid);
  }
  const selected = top ? await topFollowerIds() : ids;
  if (!selected.length) throw new InputError("Choose an account or Top 10.");
  return chartData(selected.join(","), anchor);
}

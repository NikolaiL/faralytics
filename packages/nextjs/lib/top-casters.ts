import { dateKey, getRange, InputError, utcDate, validFid, type Profile } from "./activity.ts";
import { formatShareText, shareCredit, type ShareTarget } from "./share-credit.ts";

export const casterPeriods = {
  today: "Today",
  yesterday: "Yesterday",
  days7: "7 days",
  days30: "30 days",
  days365: "365 days",
  all: "All time",
} as const;
export const casterMetrics = {
  casts: "Most original casts",
  replies_sent: "Most replies sent",
  recasts_sent: "Top recasters",
  likes_sent: "Top Likers",
  mentions_sent: "Most mentions made",
  replies_received: "Most replied to",
  recasts_received: "Most recasts received",
  likes_received: "Most liked",
  mentions_received: "Most mentioned",
} as const;
export type CasterPeriod = keyof typeof casterPeriods;
export type CasterMetric = keyof typeof casterMetrics;
export type CasterSelection = { period: CasterPeriod; end: string; user?: string; metric?: CasterMetric };
export type CasterRank = { fid: string; score: number; position: number };
export type CasterList = {
  metric: CasterMetric;
  rows: CasterRank[];
  userPosition: number | null;
  nextRank?: CasterRank;
};
export type TopCasters = {
  lists: CasterList[];
  profiles: Profile[];
  start: string;
  through: string;
  updatedAt: string;
  checkedAt: string | null;
  catchingUp: boolean;
  partialDay: boolean;
  coverage: string;
};

export function casterSelection(params: URLSearchParams): CasterSelection {
  for (const key of ["period", "end", "user", "metric", "ts"])
    if (params.getAll(key).length > 1) throw new InputError("Choose one value for each ranking filter.");
  const period = params.get("period") || "days7";
  if (!Object.hasOwn(casterPeriods, period)) throw new InputError("Choose a valid ranking timeframe.");
  const end = params.get("end") ?? dateKey(new Date());
  getRange("365", end);
  const user = params.get("user") || undefined;
  if (user && !validFid(user)) throw new InputError("Choose a valid positive FID.");
  const metric = params.get("metric") || undefined;
  if (metric && !Object.hasOwn(casterMetrics, metric)) throw new InputError("Choose a valid ranking category.");
  const ts = params.get("ts");
  if (ts && !/^\d{13}$/.test(ts)) throw new InputError("Invalid share timestamp.");
  return { period: period as CasterPeriod, end, user, metric: metric as CasterMetric | undefined };
}

export function casterRange({ period, end }: CasterSelection) {
  const shift = (days: number) => dateKey(new Date(utcDate(end).getTime() - days * 86400000));
  const through = period === "yesterday" ? shift(1) : end;
  const start =
    period === "all"
      ? "2021-01-01"
      : period === "days365"
        ? shift(364)
        : period === "days30"
          ? shift(29)
          : period === "days7"
            ? shift(6)
            : through;
  return { start, through };
}

export function casterPath(selection: CasterSelection, ts?: string) {
  const params = new URLSearchParams({ period: selection.period, end: selection.end });
  if (selection.user) params.set("user", selection.user);
  if (selection.metric) params.set("metric", selection.metric);
  if (ts) params.set("ts", ts);
  return `/top-casters?${params}`;
}

export function casterTitle(metric: CasterMetric, period: CasterPeriod) {
  return `Top Casters · ${casterMetrics[metric]} · ${casterPeriods[period]}`;
}

export function casterShareText(
  selection: CasterSelection & { metric: CasterMetric },
  data: Pick<TopCasters, "lists" | "profiles">,
  target: Exclude<ShareTarget, "copy">,
  viewerFid?: string,
) {
  const list = data.lists.find((list) => list.metric === selection.metric);
  const position = list?.userPosition;
  const own = !!viewerFid && viewerFid === selection.user;
  const rows = own
    ? [...(list?.rows ?? []), ...(list?.nextRank ? [list.nextRank] : [])].filter(
        (row) => row.position <= 3 || (position && Math.abs(row.position - position) <= 1),
      )
    : [];
  const lines: string[] = [];
  let previous = 0;
  for (const row of rows) {
    if (previous && row.position > previous + 1) lines.push("----------");
    const profile = data.profiles.find((profile) => profile.fid === row.fid);
    const name = profile?.username ? `@${profile.username}` : `FID ${row.fid}`;
    lines.push(`#${row.position.toLocaleString("en-US")} ${name} ${row.score.toLocaleString("en-US")}`);
    previous = row.position;
  }
  const leaders = lines.length ? `\n${lines.join("\n")}` : "";
  const ranking = own
    ? `\n\nI am ${position ? `ranked #${position.toLocaleString("en-US")}` : "unranked"}. How about you?`
    : "";
  return formatShareText(
    `${casterTitle(selection.metric, selection.period)}${leaders}${ranking}\n\n${shareCredit(target)}`,
    target,
  );
}

// Positive captured actions remain historical events even if later undone; mention totals use corrected tags.
export const casterRankingSql = `
WITH scores AS (
  SELECT fid, max(generated_at) AS generated_at, [sum(casts), sum(replies_sent), sum(recasts_sent), sum(likes_sent), sum(mentions_sent),
    sum(replies_received), sum(recasts_received), sum(likes_received), sum(mentions_received)] AS scores
  FROM farcaster.top_casters_daily
  WHERE day >= {start:Date} AND day <= {through:Date} AND fid > 0
  GROUP BY fid
), ranked AS (
  SELECT metric, fid, score, generated_at,
    row_number() OVER (PARTITION BY metric ORDER BY score DESC, fid ASC) AS position
  FROM scores
  ARRAY JOIN arrayEnumerate(scores) AS metric, scores AS score
  WHERE score > 0
), positioned AS (
  SELECT *, maxIf(position, fid = {user:UInt64}) OVER (PARTITION BY metric) AS user_position
  FROM ranked
)
SELECT metric, toString(fid) AS fid, score, position, user_position, generated_at
FROM positioned
WHERE ({user:UInt64} = 0 AND position <= 10)
  OR ({user:UInt64} > 0 AND ((user_position BETWEEN 1 AND 10 AND (position <= 10 OR position = user_position + 1))
    OR (user_position > 10 AND (position <= 5 OR abs(toInt64(position) - toInt64(user_position)) <= 2))
    OR (user_position = 0 AND position <= 10)))
ORDER BY metric, position
`;

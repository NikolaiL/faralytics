import type { Profile } from "./activity";

export const FOLLOWER_COLORS = [
  "#B596F2",
  "#8BBDFF",
  "#D6FF3F",
  "#FF896B",
  "#52D6A4",
  "#F580B2",
  "#FFC65C",
  "#45D5E8",
  "#E3EAF2",
  "#D76AE8",
];
export type FollowerPoint = { ts: number; value: number };
export type FollowerSeries = {
  profile: Profile;
  followers: number | null;
  firstFollow: string | null;
  points: FollowerPoint[];
};
export type FollowerChartData = {
  series: FollowerSeries[];
  from: string | null;
  until: string;
  anchor: string;
  updatedAt: string;
  countsUpdatedAt: string | null;
};
export function followerName(series: FollowerSeries) {
  return series.profile.username ? `@${series.profile.username}` : `FID ${series.profile.fid}`;
}
export function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
export function followerDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
export function followerTimestamp(value: string) {
  return Date.parse(value.replace(" ", "T") + "Z") / 1000;
}
export function followerDomain(data: FollowerChartData) {
  const values = data.series.flatMap((s) => s.points.map((p) => p.value));
  const low = Math.min(0, ...values),
    high = Math.max(1, ...values);
  const rough = (high - low) / 5,
    power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].find((n) => n * power >= rough)! * power;
  const min = Math.floor(low / step) * step,
    max = Math.ceil(high / step) * step;
  const yTicks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);
  const start = data.from ? followerTimestamp(data.from) : followerTimestamp(data.until) - 86400;
  const end = Math.max(start + 1, followerTimestamp(data.until));
  return { start, end, min, max, yTicks };
}
export function followerTimeTicks(start: number, end: number, target = 6) {
  if (end - start < 86400 * 365)
    return Array.from({ length: target }, (_, i) => start + ((end - start) * i) / (target - 1));
  const firstYear = new Date(start * 1000).getUTCFullYear(),
    lastYear = new Date(end * 1000).getUTCFullYear();
  const step = Math.max(1, Math.ceil((lastYear - firstYear) / (target - 2)));
  const ticks = [start];
  for (let year = firstYear + 1; year <= lastYear; year += step) {
    const ts = Date.UTC(year, 0, 1) / 1000;
    if (ts - ticks.at(-1)! > (end - start) * 0.13 && end - ts > (end - start) * 0.13) ticks.push(ts);
  }
  return [...ticks, end];
}
export function nearestFollowerPoint(points: FollowerPoint[], ts: number) {
  if (!points.length) return null;
  let low = 0,
    high = points.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].ts < ts) low = mid + 1;
    else high = mid;
  }
  return low && ts - points[low - 1].ts < points[low].ts - ts ? points[low - 1] : points[low];
}
export function followersPath(data: FollowerChartData, timestamp?: string) {
  const params = new URLSearchParams({ fids: data.series.map((s) => s.profile.fid).join(","), end: data.anchor });
  if (timestamp) params.set("ts", timestamp);
  return `/followers?${params}`;
}
export function followersShareText(data: FollowerChartData) {
  return `Follower history: ${data.series.map(followerName).join(data.series.length === 2 ? " vs " : ", ")}. Captured follows minus unfollows, from ${data.from ? followerDate(followerTimestamp(data.from)) : "the available history"}.\n\nHow about you?\n\nfaralytics - created by @nikolaii.eth with @viniapp`;
}

export function followerTick(ts: number, start: number, end: number) {
  const span = end - start;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...(span < 172800
      ? ({ hour: "2-digit", minute: "2-digit", hour12: false } as const)
      : span < 90 * 86400
        ? ({ month: "short", day: "numeric" } as const)
        : ({ month: "short", year: "2-digit" } as const)),
  }).format(new Date(ts * 1000));
}

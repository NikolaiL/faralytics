export const PURPLES = ["#211b2e", "#3f2a61", "#624090", "#855dcd", "#b596f2"];
const DAY = 86_400_000;
export type Day = { date: string; actions: number; future: boolean };
export type Profile = { fid: string; username: string | null; display_name: string | null; pfp_url?: string | null };
export type Activity = {
  profile: Profile;
  period: string;
  anchor: string;
  start: string;
  end: string;
  days: Day[];
  years: number[];
  total: number;
  activeDays: number;
  elapsedDays: number;
  longestStreak: number;
  peak: number;
  peakDate: string | null;
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
  overall?: OverallActivity;
  updatedAt: string;
  catchingUp: boolean;
  coverage: string;
};
export type ActivitySummary = ReturnType<typeof summarize>;
export type OverallActivity = ActivitySummary & {
  firstDate: string | null;
  daysSinceFirst: number | null;
  asOf: string;
  currentStreak: {
    days: number;
    start: string | null;
    end: string | null;
    previousInactiveDate: string | null;
    lastActiveDate: string | null;
  };
};
export class InputError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function validFid(value: string) {
  return /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 18_446_744_073_709_551_615n;
}
export function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
export function utcDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}
export function getRange(period = "365", anchor = dateKey(new Date())) {
  const today = dateKey(new Date());
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(anchor) ||
    !Number.isFinite(utcDate(anchor).getTime()) ||
    dateKey(utcDate(anchor)) !== anchor ||
    anchor > today ||
    anchor < "2021-01-01"
  ) {
    throw new InputError("Choose a valid date between 2021 and today.");
  }
  if (period === "365") return { start: dateKey(new Date(utcDate(anchor).getTime() - 364 * DAY)), end: anchor, anchor };
  const year = Number(period);
  if (!/^\d{4}$/.test(period) || year < 2021 || year > Number(today.slice(0, 4)))
    throw new InputError("Choose a year between 2021 and this year.");
  return { start: `${year}-01-01`, end: `${year}-12-31`, anchor };
}
export function fillDays(rows: { day: string; actions: number }[], start: string, end: string, today: string) {
  const counts = new Map(rows.map((row) => [row.day, row.actions]));
  const days: Day[] = [];
  for (let stamp = utcDate(start).getTime(); stamp <= utcDate(end).getTime(); stamp += DAY) {
    const date = dateKey(new Date(stamp));
    days.push({ date, actions: date > today ? 0 : counts.get(date) || 0, future: date > today });
  }
  return days;
}
export function summarize(days: Day[]) {
  let total = 0,
    activeDays = 0,
    elapsedDays = 0,
    longestStreak = 0,
    streak = 0,
    peak = 0;
  let peakDate: string | null = null;
  let streakStart: string | null = null,
    longestStreakStart: string | null = null,
    longestStreakEnd: string | null = null;
  for (const day of days) {
    if (day.future) continue;
    elapsedDays++;
    total += day.actions;
    if (day.actions > peak) {
      peak = day.actions;
      peakDate = day.date;
    }
    if (day.actions > 0) {
      activeDays++;
      if (!streak) streakStart = day.date;
      streak++;
      if (streak > longestStreak) {
        longestStreak = streak;
        longestStreakStart = streakStart;
        longestStreakEnd = day.date;
      }
    } else streak = 0;
  }
  return { total, activeDays, elapsedDays, longestStreak, peak, peakDate, longestStreakStart, longestStreakEnd };
}
export function overallActivity(rows: { day: string; actions: number }[], asOf: string): OverallActivity {
  const available = rows.filter((row) => row.day <= asOf && row.actions > 0).sort((a, b) => a.day.localeCompare(b.day));
  const firstDate = available[0]?.day || null;
  const days = firstDate ? fillDays(available, firstDate, asOf, asOf) : [];
  return {
    ...summarize(days),
    currentStreak: currentActivityStreak(days, asOf),
    firstDate,
    daysSinceFirst: firstDate ? Math.floor((utcDate(asOf).getTime() - utcDate(firstDate).getTime()) / DAY) : null,
    asOf,
  };
}
export function currentActivityStreak(days: Day[], asOf: string): OverallActivity["currentStreak"] {
  const captured = days.filter((day) => !day.future && day.date <= asOf);
  let last = captured.length - 1;
  while (last >= 0 && captured[last].actions === 0) last--;
  const lastActiveDate = captured[last]?.date || null;
  const empty = { days: 0, start: null, end: null, previousInactiveDate: null, lastActiveDate };
  const yesterday = dateKey(new Date(utcDate(asOf).getTime() - DAY));
  if (!lastActiveDate || lastActiveDate < yesterday) return empty;
  let first = last;
  while (first > 0 && captured[first - 1].actions > 0) first--;
  return {
    days: last - first + 1,
    start: captured[first].date,
    end: lastActiveDate,
    previousInactiveDate: first > 0 ? captured[first - 1].date : null,
    lastActiveDate,
  };
}
export function streakRange(summary: Pick<ActivitySummary, "longestStreakStart" | "longestStreakEnd">) {
  return summary.longestStreakStart && summary.longestStreakEnd
    ? `${activityDate(summary.longestStreakStart)} – ${activityDate(summary.longestStreakEnd)}`
    : "—";
}
export function activeDaysPercent(summary: Pick<ActivitySummary, "activeDays" | "elapsedDays">) {
  const percentage = summary.elapsedDays ? (summary.activeDays / summary.elapsedDays) * 100 : 0;
  return `${percentage.toLocaleString("en-US", { maximumFractionDigits: 1 })}% of days`;
}
export function activityStatItems(summary: ActivitySummary & { currentStreak?: OverallActivity["currentStreak"] }) {
  return [
    {
      key: "activeDays",
      label: "Active days",
      value: summary.activeDays,
      unit: "days",
      detail: activeDaysPercent(summary),
    },
    {
      key: "longestStreak",
      label: "Longest streak",
      value: summary.longestStreak,
      unit: "days",
      detail: streakRange(summary),
    },
    ...(summary.currentStreak
      ? [
          {
            key: "currentStreak",
            label: "Current streak",
            value: summary.currentStreak.days,
            unit: "days",
            detail:
              summary.currentStreak.start && summary.currentStreak.end
                ? `${activityDate(summary.currentStreak.start)} → ${activityDate(summary.currentStreak.end)}`
                : "—",
          },
        ]
      : []),
    {
      key: "peak",
      label: "Actions on busiest day",
      value: summary.peak,
      unit: "actions",
      detail: activityDate(summary.peakDate),
    },
  ];
}
export function firstActivityLabel(overall: OverallActivity) {
  return overall.firstDate
    ? `First activity reported on ${activityDate(overall.firstDate)} - ${overall.daysSinceFirst?.toLocaleString("en-US")} days ago.`
    : "No captured activity reported yet.";
}
export function colorLevel(actions: number, peak: number) {
  if (!actions || !peak) return 0;
  return Math.min(4, Math.max(1, Math.ceil((Math.log1p(actions) / Math.log1p(peak)) * 4)));
}
export function grid(days: Day[]) {
  const offset = utcDate(days[0].date).getUTCDay();
  return {
    offset,
    columns: Math.ceil((offset + days.length) / 7),
    cells: days.map((day, index) => ({ ...day, column: Math.floor((offset + index) / 7), row: (offset + index) % 7 })),
  };
}
export function periodLabel(period: string) {
  return period === "365" ? "the past 365 days" : period;
}
export function sharePath(fid: string, period: string, anchor: string, timestamp?: string, compare?: string) {
  const params = new URLSearchParams({ period, end: anchor });
  if (timestamp) params.set("ts", timestamp);
  if (compare) params.set("compare", compare);
  return `/share/${fid}?${params}`;
}

export type SearchProfile = Profile & { followerCount: number | null; pfp_url: string | null };
export function rankSearchUsers(users: unknown[], exactFid?: string): SearchProfile[] {
  const unique = new Map<string, SearchProfile>();
  for (const value of users) {
    if (!value || typeof value !== "object") continue;
    const user = value as Record<string, unknown>;
    if (typeof user.fid !== "string" && (typeof user.fid !== "number" || !Number.isSafeInteger(user.fid))) continue;
    const fid = String(user.fid);
    if (!validFid(fid) || unique.has(fid)) continue;
    const pfp = (user.pfp as { url?: unknown } | undefined)?.url;
    unique.set(fid, {
      fid,
      username: typeof user.username === "string" ? user.username : null,
      display_name: typeof user.displayName === "string" ? user.displayName : null,
      pfp_url: typeof pfp === "string" && /^https?:\/\//i.test(pfp) ? pfp : null,
      followerCount:
        typeof user.followerCount === "number" && Number.isSafeInteger(user.followerCount) && user.followerCount >= 0
          ? user.followerCount
          : null,
    });
  }
  return [...unique.values()]
    .sort(
      (a, b) =>
        Number(b.fid === exactFid) - Number(a.fid === exactFid) ||
        (b.followerCount ?? -1) - (a.followerCount ?? -1) ||
        (a.username || a.fid).localeCompare(b.username || b.fid),
    )
    .slice(0, 8);
}

export function activityDate(date: string | null) {
  return date
    ? utcDate(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "—";
}

function streakShareText(activity: Pick<Activity, "profile" | "overall">, own = false) {
  if (!activity.overall) return "";
  const days = (value: number) => `${value.toLocaleString("en-US")} ${value === 1 ? "day" : "days"}`;
  const longest =
    activity.overall.currentStreak.days === activity.overall.longestStreak
      ? ""
      : ` and ${own ? "my" : "their"} longest streak was ${days(activity.overall.longestStreak)}`;
  return `${own ? "My" : `${accountName(activity)}'s`} current activity streak is ${days(activity.overall.currentStreak.days)}${longest}.`;
}
export function activityShareText(
  activity: Pick<Activity, "profile" | "total" | "period" | "overall">,
  viewerFid?: string,
) {
  const name = accountName(activity);
  const own = viewerFid === activity.profile.fid;
  const subject = own ? "I have" : `${name} has`;
  const streak = streakShareText(activity, own);
  return `${subject} ${activity.total.toLocaleString("en-US")} captured Farcaster actions in ${periodLabel(activity.period)}. A year, one square at a time.${streak ? `\n\n${streak}` : ""}\n\nHow about you?`;
}

export const BLUES = ["#192231", "#243c5c", "#365f91", "#528bd0", "#8bbdff"];
export function accountName(activity: Pick<Activity, "profile">) {
  return activity.profile.username ? `@${activity.profile.username}` : `FID ${activity.profile.fid}`;
}
export function comparisonPeak(first: Pick<Activity, "peak">, second: Pick<Activity, "peak">) {
  return Math.max(first.peak, second.peak);
}
export function comparisonStats(first: Activity, second: Activity) {
  return [
    { key: "activeDays", label: "Active days", unit: "days", first: first.activeDays, second: second.activeDays },
    {
      key: "longestStreak",
      label: "Longest streak",
      unit: "days",
      first: first.longestStreak,
      second: second.longestStreak,
    },
    {
      key: "peak",
      label: "Busiest day",
      unit: "actions",
      first: first.peak,
      second: second.peak,
      firstDate: first.peakDate,
      secondDate: second.peakDate,
    },
  ].map((stat) => ({
    ...stat,
    winner: stat.first === stat.second ? "tie" : stat.first > stat.second ? "first" : "second",
  }));
}
export function comparisonShareText(first: Activity, second: Activity) {
  const streaks = [first, second]
    .map((activity) => streakShareText(activity))
    .filter(Boolean)
    .join("\n");
  return `${accountName(first)} vs ${accountName(second)}: ${first.total.toLocaleString("en-US")} vs ${second.total.toLocaleString("en-US")} captured Farcaster actions in ${periodLabel(first.period)}. A year, one square at a time.${streaks ? `\n\n${streaks}` : ""}\n\nHow about you?`;
}

export function activityYears(
  first?: Pick<Activity, "years">,
  second?: Pick<Activity, "years">,
  currentYear = new Date().getUTCFullYear(),
) {
  const firstYear = Math.min(currentYear, ...(first?.years || []), ...(second?.years || []));
  return Array.from({ length: currentYear - firstYear + 1 }, (_, index) => currentYear - index);
}

export function parseFollowerIds(value: string) {
  if (!value || value.length > 220) throw new InputError("Choose between one and ten accounts.");
  const ids = value.split(",");
  if (ids.length > 10 || ids.some((fid) => !validFid(fid)))
    throw new InputError("Choose up to ten valid positive FIDs.");
  return [...new Set(ids)];
}

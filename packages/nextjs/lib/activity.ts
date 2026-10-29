export const PURPLES = ["#211b2e", "#3f2a61", "#624090", "#855dcd", "#b596f2"];
const DAY = 86_400_000;
export type Day = { date: string; actions: number; future: boolean };
export type Profile = { fid: string; username: string | null; display_name: string | null };
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
  longestStreak: number;
  peak: number;
  updatedAt: string;
  catchingUp: boolean;
  coverage: string;
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
    longestStreak = 0,
    streak = 0,
    peak = 0;
  for (const day of days) {
    if (day.future) continue;
    total += day.actions;
    peak = Math.max(peak, day.actions);
    if (day.actions > 0) {
      activeDays++;
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else streak = 0;
  }
  return { total, activeDays, longestStreak, peak };
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
export function sharePath(fid: string, period: string, anchor: string) {
  return `/share/${fid}?${new URLSearchParams({ period, end: anchor })}`;
}

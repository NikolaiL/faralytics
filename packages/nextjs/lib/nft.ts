import { colorLevel, utcDate, type Activity } from "./activity";
export function activitySnapshot(data: Activity) {
  const day = (date: string) => Math.floor(utcDate(date).getTime() / 86_400_000);
  return {
    fid: BigInt(data.profile.fid),
    startDay: day(data.start),
    anchorDay: day(data.anchor),
    year: data.period === "365" ? 0 : Number(data.period),
    total: BigInt(data.total),
    activeDays: data.activeDays,
    longestStreak: data.longestStreak,
    peak: data.peak,
    peakDay: data.peakDate ? day(data.peakDate) : 0,
    username: (data.profile.username || data.profile.fid).toLowerCase(),
    levels: ("0x" +
      data.days
        .map((d) => (d.future ? 5 : colorLevel(d.actions, data.peak)).toString(16).padStart(2, "0"))
        .join("")) as `0x${string}`,
  };
}

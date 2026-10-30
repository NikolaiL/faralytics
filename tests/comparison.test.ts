import assert from "node:assert/strict";
import { test } from "node:test";
import { BLUES, PURPLES, colorLevel, comparisonPeak, comparisonStats, comparisonShareText, sharePath, fillDays, getRange, summarize, type Activity } from "../packages/nextjs/lib/activity.ts";
function activity(fid: string, actions: number[]): Activity {
  const range = getRange("2024", "2024-03-01");
  const days = fillDays(actions.map((count, i) => ({ day: `2024-01-0${i+1}`, actions: count })), range.start, range.end, range.anchor);
  return { profile: { fid, username: `user${fid}`, display_name: null }, period: "2024", ...range, days, ...summarize(days), years: [2024], updatedAt: "", catchingUp: false, coverage: "" };
}
test("comparison intensity uses the maximum across both accounts and treats zeros consistently", () => {
  const first = activity("1", [10]), second = activity("2", [100]);
  assert.equal(comparisonPeak(first, second), 100);
  assert.equal(colorLevel(first.peak, comparisonPeak(first, second)), 3);
  assert.equal(colorLevel(second.peak, comparisonPeak(first, second)), 4);
  assert.equal(colorLevel(0, comparisonPeak(first, second)), 0);
  assert.equal(comparisonPeak(activity("1", []), activity("2", [])), 0);
  assert.equal(PURPLES.length, BLUES.length);
});
test("joint stats award strictly higher values and identify ties including zero-activity accounts", () => {
  const stats = comparisonStats(activity("1", [10, 0, 10]), activity("2", [5, 5, 5]));
  assert.deepEqual(stats.map(s => [s.key, s.winner]), [["activeDays", "second"], ["longestStreak", "second"], ["peak", "first"]]);
  assert.ok(comparisonStats(activity("1", []), activity("2", [])).every(s => s.winner === "tie"));
});
test("comparison share text and URLs preserve both accounts, range and cache-buster", () => {
  const first = activity("18446744073709551615", [10]), second = activity("2", [100]);
  const url = new URL(sharePath(first.profile.fid, first.period, first.anchor, "1793250000123", second.profile.fid), "https://faralytics.vercel.app");
  assert.equal(url.pathname, "/share/18446744073709551615");
  assert.equal(url.searchParams.get("compare"), "2");
  assert.equal(url.searchParams.get("period"), "2024");
  assert.equal(url.searchParams.get("end"), "2024-03-01");
  assert.equal(url.searchParams.get("ts"), "1793250000123");
  assert.match(comparisonShareText(first, second), /^@user18446744073709551615 vs @user2: 10 vs 100 captured Farcaster actions in 2024/);
  assert.match(comparisonShareText({...first, profile:{...first.profile, username:null}}, second), /^FID 18446744073709551615 vs @user2/);
});

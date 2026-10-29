import assert from "node:assert/strict";
import { test } from "node:test";
import { activityShareText, activityDate, colorLevel, fillDays, getRange, grid, sharePath, summarize, validFid } from "../packages/nextjs/lib/activity.ts";

test("365-day range includes anchor exactly once and crosses leap day correctly", () => {
  const range = getRange("365", "2024-03-01");
  const days = fillDays([], range.start, range.end, range.anchor);
  assert.equal(days.length, 365);
  assert.equal(days.at(-1)?.date, "2024-03-01");
  assert.equal(days.filter(day => day.date === "2024-02-29").length, 1);
});
test("calendar year zero-fills leap day, masks future days and preserves every count", () => {
  const range = getRange("2024", "2024-03-01");
  const days = fillDays([{ day: "2024-02-28", actions: 3 }, { day: "2024-02-29", actions: 7 }, { day: "2024-03-01", actions: 2 }, { day: "2024-03-02", actions: 99 }], range.start, range.end, range.anchor);
  assert.equal(days.length, 366);
  assert.deepEqual(summarize(days), { total: 12, activeDays: 3, longestStreak: 3, peak: 7, peakDate: "2024-02-29" });
  assert.equal(days.find(day => day.date === "2024-03-02")?.future, true);
});
test("calendar alignment supports Sunday start and 54-week leap years", () => {
  const sunday = grid(fillDays([], "2023-01-01", "2023-12-31", "2023-12-31"));
  assert.equal(sunday.offset, 0);
  assert.equal(sunday.cells[0].row, 0);
  const leap = grid(fillDays([], "2000-01-01", "2000-12-31", "2000-12-31"));
  assert.equal(leap.columns, 54);
  assert.equal(leap.cells.at(-1)?.column, 53);
});
test("validates UInt64 FIDs without JS numeric precision loss", () => {
  assert.equal(validFid("18446744073709551615"), true);
  for (const value of ["18446744073709551616", "0", "-1", "001", "1 OR 1=1", "1.2", ""]) assert.equal(validFid(value), false);
});
test("rejects malformed/future periods and dates", () => {
  for (const year of ["2020", "1900", "3000", "2e3", "2024 OR 1=1"]) assert.throws(() => getRange(year));
  for (const date of ["2024-02-30", "2024-13-01", "3000-01-01", "invalid", "2024-1-01"]) assert.throws(() => getRange("365", date));
});
test("intensity and shared links preserve the selected FID, period and anchor", () => {
  assert.equal(colorLevel(0, 20), 0); assert.equal(colorLevel(20, 20), 4); assert.equal(colorLevel(1, 20) > 0, true);
  const url = new URL(sharePath("366713", "2024", "2024-03-01"), "http://localhost");
  assert.equal(url.pathname, "/share/366713"); assert.equal(url.searchParams.get("period"), "2024"); assert.equal(url.searchParams.get("end"), "2024-03-01");
});

test("search ranks all candidates by followers before limiting and deduplicates FIDs", async () => {
  const { rankSearchUsers } = await import("../packages/nextjs/lib/activity.ts");
  const users = Array.from({ length: 12 }, (_, i) => ({ fid: i + 1, username: `user${i}`, followerCount: i * 100 }));
  const ranked = rankSearchUsers([...users, users[0]]);
  assert.equal(ranked.length, 8);
  assert.deepEqual(ranked.map(user => user.fid), ["12", "11", "10", "9", "8", "7", "6", "5"]);
  assert.equal(rankSearchUsers(users, "1")[0].fid, "1");
});
test("search preserves UInt64 strings and handles malformed or absent follower counts", async () => {
  const { rankSearchUsers } = await import("../packages/nextjs/lib/activity.ts");
  const ranked = rankSearchUsers([null, {fid:0}, {fid:Number.MAX_SAFE_INTEGER+1}, {fid:"18446744073709551615"}, {fid:2, followerCount:0}, {fid:3, followerCount:-1}]);
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].fid, "2");
  assert.equal(ranked.find(user => user.fid === "18446744073709551615")?.followerCount, null);
});


test("search keeps HTTP(S) profile images and ignores missing or unsafe image URLs", async () => {
  const { rankSearchUsers } = await import("../packages/nextjs/lib/activity.ts");
  const users = rankSearchUsers([{fid:1,pfp:{url:"https://example.com/avatar.png"}}, {fid:2,pfp:{url:"javascript:alert(1)"}}, {fid:3}]);
  assert.equal(users.find(user=>user.fid==="1")?.pfp_url, "https://example.com/avatar.png");
  assert.equal(users.find(user=>user.fid==="2")?.pfp_url, null);
  assert.equal(users.find(user=>user.fid==="3")?.pfp_url, null);
});


test("share links preserve an explicit cache-busting timestamp without changing the chart selection", () => {
  const url = new URL(sharePath("366713", "2026", "2026-10-29", "1793250000123"), "http://localhost");
  assert.equal(url.searchParams.get("ts"), "1793250000123");
  assert.equal(url.searchParams.get("period"), "2026");
  assert.equal(url.searchParams.get("end"), "2026-10-29");
  assert.equal(new URL(sharePath("366713", "2026", "2026-10-29"), "http://localhost").searchParams.has("ts"), false);
});


test("default brand chart spells FARALYTICS in a seven-row pixel grid", async () => {
  const { BRAND_GRID, brandCellLevel } = await import("../packages/nextjs/lib/brand.ts");
  const letterLevels = new Set<number>();
  BRAND_GRID.forEach((row,y)=>[...row].forEach((pixel,x)=>{
    const level=brandCellLevel(pixel,x,y);
    if(pixel === "1") letterLevels.add(level);
    else assert.ok(level <= 2);
  }));
  assert.deepEqual([...letterLevels].sort(),[3,4]);
  assert.equal(BRAND_GRID.length, 7);
  for(const row of BRAND_GRID) { assert.equal(row.length, 59); assert.match(row, /^[01]+$/); }
  assert.equal(BRAND_GRID.map(row=>row.slice(0,5)).join("/"), "11111/10000/10000/11110/10000/10000/10000");
  for(let i=0;i<9;i++) assert.ok(BRAND_GRID.every(row=>row[i*6+5]==="0"));
});

test("busiest date uses the first tied active day, ignores future days and formats in UTC", () => {
  const result = summarize([
    {date:"2026-10-22", actions:79, future:false},
    {date:"2026-10-23", actions:79, future:false},
    {date:"2026-10-30", actions:100, future:true},
  ]);
  assert.equal(result.peakDate, "2026-10-22");
  assert.equal(activityDate(result.peakDate), "Oct 22, 2026");
  assert.equal(summarize([{date:"2026-10-22", actions:0, future:false}]).peakDate, null);
  assert.equal(activityDate(null), "—");
});

test("share text uses first person only when the viewer FID matches the selected profile", () => {
  const activity = { profile: {fid:"366713", username:"nikolaii.eth", display_name:"Nikolai"}, total:4633, period:"365" };
  assert.equal(activityShareText(activity, "366713"), "I have 4,633 captured Farcaster actions in the past 365 days. A year, one square at a time.");
  assert.match(activityShareText(activity, "2"), /^@nikolaii\.eth has 4,633/);
  assert.match(activityShareText(activity), /^@nikolaii\.eth has 4,633/);
  assert.match(activityShareText({...activity, period:"2024"}, "366713"), /actions in 2024\./);
  assert.match(activityShareText({...activity,profile:{...activity.profile,username:null}}), /^FID 366713 has/);
});

test("logo uses exactly 25 activity cells with a bright northeast arrow", async () => {
  const { LOGO_GRID, LOGO_PIXELS } = await import("../packages/nextjs/lib/brand.ts");
  assert.equal(LOGO_GRID.length, 5);
  for(const row of LOGO_GRID) assert.equal(row.length,5);
  assert.equal(LOGO_PIXELS.length,25);
  assert.equal(LOGO_PIXELS.filter(([, , level])=>level>=3).length,9);
  assert.ok(LOGO_PIXELS.find(([x,y])=>x===4&&y===0)![2]>=3);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFollowerIds } from "../packages/nextjs/lib/activity.ts";
import { FOLLOWER_COLORS, compactNumber, followerDomain, followerTimeTicks, followerTick, followersPath, followersShareText, nearestFollowerPoint, type FollowerChartData } from "../packages/nextjs/lib/followers.ts";
const data: FollowerChartData = { from: "2023-03-18 01:00:13", until: "2026-10-30 03:00:00", anchor: "2026-10-30", updatedAt: "", countsUpdatedAt: null, series: [
 {profile:{fid:"366713",username:"nikolaii.eth",display_name:null},followers:66045,firstFollow:"2024-02-21 21:02:42",points:[{ts:1679101213,value:0},{ts:1793329200,value:62066}]},
 {profile:{fid:"10956",username:"1dolinski",display_name:null},followers:9222,firstFollow:"2023-03-18 01:00:13",points:[{ts:1679101213,value:1},{ts:1793329200,value:8300}]},
] };
test("follower selections preserve UInt64 strings, order and limits",()=>{
 assert.deepEqual(parseFollowerIds("18446744073709551615,366713,366713"),["18446744073709551615","366713"]);
 for(const input of ["", "0", "001", "3,", "3,-1", "18446744073709551616", "1 OR 1=1", Array.from({length:11},(_,i)=>String(i+1)).join(",")])assert.throws(()=>parseFollowerIds(input));
});
test("follower plots start from actual first follow, share scale and include both temporal endpoints",()=>{
 const d=followerDomain(data);assert.equal(d.start,1679101213);assert.equal(d.min,0);assert.ok(d.max>=62066);
 const ticks=followerTimeTicks(d.start,d.end);assert.equal(ticks[0],d.start);assert.equal(ticks.at(-1),d.end);assert.ok(ticks.every((t,i)=>!i||t>ticks[i-1]));
 const negative=followerDomain({...data,series:[{...data.series[0],points:[{ts:d.start,value:-17},{ts:d.end,value:10}]}]});assert.ok(negative.min<=-17);assert.ok(negative.max>=10);
 assert.equal(compactNumber(100000),"100K");assert.equal(new Set(FOLLOWER_COLORS).size,10);
});
test("nearest sampled tooltips disclose actual samples and handle empty series",()=>{
 const points=[{ts:100,value:5},{ts:300,value:8}];assert.equal(nearestFollowerPoint(points,180)?.value,5);assert.equal(nearestFollowerPoint(points,250)?.value,8);assert.equal(nearestFollowerPoint([],150),null);
});
test("follower share URLs freeze both accounts, end date and timestamp",()=>{
 const path=followersPath(data,"1793250000123"),url=new URL(path,"https://faralytics.vercel.app");assert.equal(url.pathname,"/followers");assert.equal(url.searchParams.get("fids"),"366713,10956");assert.equal(url.searchParams.get("end"),"2026-10-30");assert.equal(url.searchParams.get("ts"),"1793250000123");
 const text=followersShareText(data);assert.match(text,/@nikolaii.eth vs @1dolinski/);assert.ok(text.endsWith("faralytics - created by @nikolaii.eth with @viniapp"));
});


test("short follower histories use readable day or hour ticks rather than repeated month labels",()=>{
 const start=Date.UTC(2026,9,1)/1000,end=Date.UTC(2026,9,30)/1000;
 assert.notEqual(followerTick(start,start,end),followerTick(end,start,end));
 assert.notEqual(followerTick(start,start,start+3600),followerTick(start+3600,start,start+3600));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { timelineQuery } from "../packages/nextjs/lib/follow-timeline.ts";
import { timelineSharePath, timelineShareText, type TimelineShareData } from "../packages/nextjs/lib/timeline-share.ts";
const ts = Date.now().toString();
test("latest follower shares filter follows before limiting and deduplicate accounts at the share time", () => {
  const q=timelineQuery({target:"366713",shareAt:ts});
  assert.match(q.sql,/FROM snapchain.received_actions PREWHERE recipient_fid/);
  assert.match(q.sql,/action_type = 'follow'/);assert.match(q.sql,/timestamp <= toDateTime/);
  assert.match(q.sql,/LIMIT 1 BY fid\s+LIMIT 21/);
  assert.equal(q.params.asOf,Math.floor(Number(ts)/1000).toString());
  assert.equal(q.params.target,"366713");
  assert.throws(()=>timelineQuery({shareAt:"bad"}));
  assert.throws(()=>timelineQuery({shareAt:"1609459199999"}));
  assert.throws(()=>timelineQuery({shareAt:(Date.now()+120000).toString()}));
  assert.match(timelineQuery({actor:"3",shareAt:ts}).sql,/LIMIT 1 BY target_fid/);
  assert.match(timelineQuery({actor:"3",target:"366713",shareAt:ts}).sql,/LIMIT 1 BY timestamp, hash, fid, action_type/);
  assert.match(timelineQuery({shareAt:ts}).sql,/FROM snapchain.action_messages /);
  assert.match(timelineQuery({target:"366713"}).sql,/LIMIT 1 BY timestamp, hash, fid, action_type/);
});
test("thank-you copy mentions available usernames once and uses platform credits and cache-busting links",()=>{
  const profile={fid:"366713",username:"nikolaii.eth",display_name:null};
  const actor={fid:"3",username:"alice",display_name:null};
  const event={id:"a",cursor:"",timestamp:new Date().toISOString(),action:"follow" as const,actor,target:profile};
  const data:TimelineShareData={filters:{actor:null,target:profile},events:[event,{...event,id:"b"},{...event,id:"c",actor:{...actor,username:null}}],generatedAt:new Date().toISOString()};
  assert.equal(timelineShareText(data,"farcaster"),"Thanks to my latest followers: @alice\n\nHow about you?\n\nfaralytics - created by @nikolaii.eth with @viniapp");
  assert.match(timelineShareText(data,"x"),/@NikolaiLeb with @viniapp_xyz$/);
  assert.match(timelineShareText({...data,filters:{actor:null,target:null}},"farcaster"),/^Explore the latest/);
  assert.match(timelineShareText({...data,events:[]},"farcaster"),/^Explore the latest/);
  for(const filters of [{actor,target:null},{actor,target:profile},{actor:null,target:null}]){
    const text=timelineShareText({...data,filters},"farcaster");
    assert.ok(!text.includes('@alice'),'non-target-only shares do not tag event users');
    assert.ok(text.endsWith('@nikolaii.eth with @viniapp'));
  }
  const pair=new URL(timelineSharePath({actor:"3",target:"366713"},ts),"https://faralytics.vercel.app");
  assert.equal(pair.searchParams.get('actor'),'3');assert.equal(pair.searchParams.get('target'),'366713');
  const url=new URL(timelineSharePath({target:"366713"},ts),"https://faralytics.vercel.app");
  assert.equal(url.searchParams.get("target"),"366713");assert.equal(url.searchParams.get("ts"),ts);
  assert.equal(new URL(timelineSharePath({},ts),url).searchParams.has("target"),false);
  assert.equal(new URL(timelineSharePath({},ts),url).searchParams.get("all"),"1");
});

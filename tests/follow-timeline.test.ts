import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeTimeline, parseTimelineCursor, relativeEventTime, timelineQuery, timelineSelection, type TimelineEvent } from "../packages/nextjs/lib/follow-timeline.ts";
import { parseLookup } from "../packages/nextjs/lib/lookup-log.ts";
const hash = "0x" + "a".repeat(40);
const cursor = `1793433600:${hash}`;
test("timeline selections validate actor/target and cursor boundaries without losing UInt64 precision", () => {
  assert.deepEqual(timelineSelection(new URLSearchParams("actor=@v&target=18446744073709551615")), {actor:"v",target:"18446744073709551615",before:undefined,after:undefined});
  for(const query of ['actor=366713&target=366713','actor=@V&target=v']){
    const selection=timelineSelection(new URLSearchParams(query));assert.ok(selection.actor);assert.equal(selection.target,undefined);
  }
  assert.equal(parseTimelineCursor(cursor).hash, hash);
  for (const input of ["actor=0","actor=18446744073709551616","actor=1&actor=2","target=a%27b",`before=${cursor}&after=${cursor}`,"after=123:nope"]) assert.throws(()=>timelineSelection(new URLSearchParams(input)));
});
test("timeline SQL selects indexed access paths, deduplicates events, and pages newest/older/newer without offsets", () => {
  const global=timelineQuery({});assert.match(global.sql,/snapchain.action_messages\s/);assert.match(global.sql,/LIMIT 1 BY/);assert.match(global.sql,/LIMIT 21/);assert.match(global.sql,/'follow', 'unfollow'/);assert.doesNotMatch(global.sql,/FINAL|OFFSET/);
  const actor=timelineQuery({actor:"366713",before:cursor});assert.match(actor.sql,/action_messages_by_fid/);assert.match(actor.sql,/PREWHERE fid/);assert.match(actor.sql,/\(timestamp, hash\) </);assert.equal(actor.params.actor,"366713");
  const both=timelineQuery({actor:"3318053",target:"366713",after:cursor});assert.match(both.sql,/received_actions/);assert.match(both.sql,/PREWHERE recipient_fid/);assert.match(both.sql,/fid = \{actor/);assert.match(both.sql,/\(timestamp, hash\) >/);assert.match(both.sql,/timestamp ASC, hash ASC/);
});
test("timeline merging keeps both follow and unfollow, deduplicates overlaps and orders same-second events by hash", () => {
  const event=(id:string,timestamp:string,action:"follow"|"unfollow"="follow")=>({id,timestamp,action}) as TimelineEvent;
  const a=event("a","2026-10-31T00:00:00Z"),b=event("b",a.timestamp,"unfollow"),c=event("c","2026-10-31T00:00:01Z");
  assert.deepEqual(mergeTimeline([a,b],[b,c]).map(e=>e.id),["c","b","a"]);
  const now=Date.parse("2026-10-31T00:01:00Z");assert.equal(relativeEventTime("2026-10-31T00:00:55Z",now),"5 seconds ago");assert.equal(relativeEventTime("2026-10-31T00:00:55Z",now+1000),"6 seconds ago");assert.equal(relativeEventTime("2026-10-31T00:00:00Z",now),"1 minute ago");assert.equal(relativeEventTime("2026-10-31T00:02:00Z",now),"0 seconds ago");
});
test("timeline filter lookups use the shared two-account session logger", () => {
  const input={lookupId:"00000000-0000-4000-8000-000000000001",tool:"follow-timeline",fids:["3318053","366713"],period:"all",end:"2026-10-31"};assert.equal(parseLookup(input).tool,"follow-timeline");assert.throws(()=>parseLookup({...input,period:"365"}));assert.throws(()=>parseLookup({...input,fids:["1","2","3"]}));
});

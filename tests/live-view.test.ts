import assert from "node:assert/strict";
import { test } from "node:test";
import { livePath, liveEventAction, liveOgEvents, liveOgEventHeight, liveClockParts, liveQuoteIds, liveSelection, liveEventsQuery, mergeLiveEvents, type LiveEvent } from "../packages/nextjs/lib/live-view.ts";

test("live filters validate types, UInt64 users and cursors", () => {
  assert.equal(liveSelection(new URLSearchParams("user=@nikolaii.eth&type=mention")).user, "nikolaii.eth");
  assert.equal(liveSelection(new URLSearchParams("user=18446744073709551615")).user, "18446744073709551615");
  for (const input of ["user=0", "user=18446744073709551616", "user=x';--", "type=constructor", "direction=constructor", "direction=actor&direction=both", "type=cast&type=like", "after=bad"])
    assert.throws(() => liveSelection(new URLSearchParams(input)));
});
test("live queries bound future events, use indexed user reads and drain newer events in order", () => {
  const cursor = "1794742348:0x" + "a".repeat(40);
  const query = liveEventsQuery("18446744073709551615", "mention", cursor);
  assert.match(query.sql, /action_messages_by_fid/);
  assert.match(query.sql, /PREWHERE fid = \{user:UInt64\}/);
  assert.match(query.sql, /timestamp <= toDateTime\(\{asOf:UInt32\}/);
  assert.match(query.sql, /action_type IN \('cast','reply'\)/);
  assert.match(query.sql, /ORDER BY timestamp ASC,hash ASC LIMIT 61/);
  assert.equal(query.params.user, "18446744073709551615");
  assert.equal(query.params.cursorHash, "0x" + "a".repeat(40));
  assert.ok(Number(query.params.asOf) <= Date.now() / 1000);
  const global = liveEventsQuery(undefined, "like");
  assert.match(global.sql, /snapchain.action_messages\s/);
  assert.match(global.sql, /action_type = \{action:String\}/);
  assert.equal(global.params.action, "like");
  assert.match(global.sql, /ORDER BY timestamp DESC/);
});
test("live UTC clock rolls over and feed merges once in descending order with a bound", () => {
  assert.deepEqual(liveClockParts(Date.parse("2026-11-15T23:59:59Z")), {year:2026,month:"Nov",day:15,hour:23,minute:59,second:59});
  assert.equal(liveClockParts(Date.parse("2026-11-16T00:00:00Z")).day, 16);
  const rows = Array.from({length:120}, (_,i) => ({id:String(i),timestamp:new Date(1794742348000+i*1000).toISOString()} as LiveEvent));
  const merged = mergeLiveEvents(rows.slice(0,100), rows.slice(80));
  assert.equal(merged.length,100);
  assert.equal(new Set(merged.map(r => r.id)).size,100);
  assert.equal(merged[0].id,"119");
  assert.equal(merged.at(-1)?.id,"20");
});


test("quote cast IDs decode stored Buffer hashes, preserve UInt64 FIDs, and ignore bad embeds", () => {
  const bytes = Array.from({length:20},(_,i)=>i);
  const hash = bytes.map(byte=>byte.toString(16).padStart(2,"0")).join("");
  const stored = JSON.stringify({type:"Buffer",data:bytes});
  assert.deepEqual(liveQuoteIds([["", ""], ["18446744073709551615", stored], ['"18446744073709551615"',JSON.stringify("0x"+hash)]]), [{fid:"18446744073709551615",hash:"0x"+hash}]);
  for (const entry of [["0",stored],["18446744073709551616",stored],["2",JSON.stringify({type:"Buffer",data:[256,...bytes.slice(1)]})],["2","not json"],["2",JSON.stringify({type:"Buffer",data:[1]})]] as [string,string][])
    assert.deepEqual(liveQuoteIds([entry]), []);
});


test("bubble action links distinguish replies from original casts and quote references", () => {
 const own="0x"+"a".repeat(40),original="0x"+"b".repeat(40);
 const event={cursor:"1794742348:"+own,castHash:original,target:{fid:"3",username:"dwr",display_name:null},action:"reply"} as LiveEvent;
 assert.equal(liveEventAction(event).actionHash,own);
 assert.equal(liveEventAction(event).castHash,original);
 assert.equal(liveEventAction(event).verb,"replied");
 for(const action of ["like","recast"] as const){const links=liveEventAction({...event,action});assert.equal(links.actionHash,original);assert.equal(links.castHash,original);}
 const cast=liveEventAction({...event,action:"cast",castHash:own});assert.equal(cast.verb,"casted");assert.equal(cast.actionHash,own);assert.equal(cast.castHash,null);
 const quote=liveEventAction({...event,action:"cast",castHash:own,quotes:[{author:event.target!,hash:original,text:"Original"}]});assert.equal(quote.verb,"quote-recasted");assert.equal(quote.actionHash,own);assert.equal(quote.castHash,original);
 assert.equal(liveEventAction({...event,action:"mention"}).actionHash,own);
});
test("OG uses the largest ordered prefix that fits each image below the single metrics row", () => {
 for(const text of ["","Cast commentary"]){
  const events=Array.from({length:20},(_,i)=>({id:String(i),text} as LiveEvent));
  for(const height of [600,800]){
   const visible=liveOgEvents(events,height),used=visible.reduce((sum,event)=>sum+liveOgEventHeight(event),0)+Math.max(0,visible.length-1)*6;
   assert.ok(visible.length>0);assert.deepEqual(visible,events.slice(0,visible.length));assert.ok(used<=height-250);
   assert.ok(used+6+liveOgEventHeight(events[visible.length])>height-250);
  }
  assert.ok(liveOgEvents(events,800).length>liveOgEvents(events,600).length);
 }
});


test("incoming and combined roles use recipient indexes and preserve direction in share links", () => {
 assert.equal(liveSelection(new URLSearchParams("user=3&direction=target")).direction,"target");
 assert.equal(liveSelection(new URLSearchParams("direction=both")).direction,"actor");
 const incoming=liveEventsQuery("18446744073709551615","all",undefined,"target");
 assert.match(incoming.sql,/recipient_fid = \{user:UInt64\}/);assert.match(incoming.sql,/live_cast_recipients/);assert.match(incoming.sql,/SELECT DISTINCT fid,timestamp,hash/);assert.equal(incoming.params.user,"18446744073709551615");
 assert.ok(livePath({user:"3",type:"all",direction:"target"},"f".repeat(64)).includes("direction=target"));
 const both=liveEventsQuery("3","mention",undefined,"both");assert.match(both.sql,/is_mention=1/);assert.match(both.sql,/UNION ALL/);
 const actions=liveEventsQuery(undefined,"all").params.actions;for(const key of ["follow","unfollow","unlike","unrecast","cast_delete"])assert.ok(actions.includes("'"+key+"'"));
});
test("follow and undo/delete bubbles use meaningful profile or original-cast destinations",()=>{
 const own="0x"+"a".repeat(40),original="0x"+"b".repeat(40);
 const event={cursor:"1794742348:"+own,castHash:original,target:{fid:"18446744073709551615",username:null,display_name:null},action:"follow"} as LiveEvent;
 for(const action of ["follow","unfollow"] as const){const link=liveEventAction({...event,action});assert.equal(link.castHash,null);assert.ok(link.actionUrl.endsWith("~/profiles/18446744073709551615"));assert.equal(link.profileAction,true);}
 for(const action of ["unlike","unrecast","cast_delete"] as const){const link=liveEventAction({...event,action});assert.equal(link.castHash,original);assert.ok(link.actionUrl.endsWith(original));}
 assert.equal(liveEventAction({...event,action:"cast_delete"}).target,null);
});

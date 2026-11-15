import assert from "node:assert/strict";
import { test } from "node:test";
import { liveClockParts, liveSelection, liveEventsQuery, mergeLiveEvents, type LiveEvent } from "../packages/nextjs/lib/live-view.ts";

test("live filters validate types, UInt64 users and cursors", () => {
  assert.equal(liveSelection(new URLSearchParams("user=@nikolaii.eth&type=mention")).user, "nikolaii.eth");
  assert.equal(liveSelection(new URLSearchParams("user=18446744073709551615")).user, "18446744073709551615");
  for (const input of ["user=0", "user=18446744073709551616", "user=x';--", "type=constructor", "type=follow", "type=cast&type=like", "after=bad"])
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

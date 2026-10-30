import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLookup } from "../packages/nextjs/lib/lookup-log.ts";
const lookup = {lookupId: "00000000-0000-4000-8000-000000000001", tool: "activity", fids: ["366713","18446744073709551615"], period: "2025", end: "2026-10-30"};
test("lookup groups preserve ordered UInt64 FIDs and bounded tool metadata", () => {
 assert.deepEqual(parseLookup(lookup), {lookupId:lookup.lookupId,tool:lookup.tool,fids:lookup.fids, metadata:{period:lookup.period,end:lookup.end}});
});
test("lookup input rejects unsupported tools, duplicate/invalid accounts, unbounded IDs and invalid dates", () => {
 for(const body of [null,{...lookup,tool:"toString"},{...lookup,tool:"unknown"},{...lookup,lookupId:"bad"},{...lookup,fids:[366713]}, {...lookup,fids:["0"]},{...lookup,fids:["1","1"]},{...lookup,fids:["18446744073709551616"]},{...lookup,fids:["1","2","3"]},{...lookup,end:"2026-02-30"},{...lookup,period:"all"}])assert.throws(()=>parseLookup(body));
 const followers=parseLookup({...lookup,tool:"followers",period:"all",fids:Array.from({length:10},(_,i)=>String(i+1))});assert.equal(followers.fids.length,10);
 assert.throws(()=>parseLookup({...lookup,tool:"followers",period:"all",fids:Array.from({length:11},(_,i)=>String(i+1))}));
});

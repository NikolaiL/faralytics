import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as live from "../packages/nextjs/lib/live-view.ts";
import { InputError } from "../packages/nextjs/lib/activity.ts";
const require=createRequire(new URL("../packages/nextjs/package.json",import.meta.url)),ts=require("typescript");
function moduleFrom(path:string,mocks:Record<string,unknown>){
 const code=ts.transpileModule(readFileSync(new URL("../packages/nextjs/"+path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{} as any};runInNewContext(code,{module,exports:module.exports,require:(id:string)=>Object.hasOwn(mocks,id)?mocks[id]:require(id),Buffer,URL,URLSearchParams,Response,console});return module.exports;
}
function words(node:any):string {
 if(node==null||typeof node==="boolean")return "";
 if(Array.isArray(node))return node.map(words).join(" ");
 if(typeof node==="object")return typeof node.type==="function"?words(node.type(node.props)):words(node.props?.children);
 return String(node);
}
test("Live View snapshot freezes all six daily metrics, filters and cutoff for both images",async()=>{
 const stored=new Map<string,unknown>();let reads=0;
 const data={date:"2026-11-15",profile:null,type:"all",totals:{asOf:"2026-11-15T12:30:00Z",today:{casts:100,replies:90,recasts:80,likes:70,mentions:60,dau:50},yesterday:{casts:10,replies:9,recasts:8,likes:7,mentions:6,dau:5}},source:{coverage:"incomplete",catchingUp:false,checkedAt:null}};
 const db=async(parts:TemplateStringsArray,...values:any[])=>{if(parts[0].startsWith("INSERT")){if(!stored.has(values[0]))stored.set(values[0],JSON.parse(values[1]));return [];}return stored.has(values[0])?[{payload:stored.get(values[0])}]:[];};
 const shares=moduleFrom("lib/live-view-shares.ts",{"server-only":{},"~~/utils/db":{getDb:()=>db},"~~/lib/activity":{InputError},"~~/lib/live-view":live,"~~/lib/live-view-data":{loadLiveView:async()=>{reads++;return data;}}});
 const snapshot=await shares.createLiveShare({type:"all"});assert.match(snapshot.id,/^[a-f0-9]{64}$/);
 const path=live.livePath({type:"all"},snapshot.id);assert.equal(path,"/live-view?share="+snapshot.id);
 data.totals.today.dau=99999;data.totals.asOf="2026-11-16T01:00:00Z";
 const og=moduleFrom("components/LiveViewOg.tsx",{"server-only":{},"~~/components/OgLogo":{OgLogo:()=>null},"~~/lib/live-view":live});
 const route=moduleFrom("app/api/og/live-view/[format]/route.tsx",{"next/og":{ImageResponse:class extends Response{constructor(tree:any,options:any){super(words(tree),{headers:options.headers});this.headers.set("test-height",String(options.height));}}},"~~/components/LiveViewOg":og,"~~/lib/activity":{InputError},"~~/lib/og-fonts":{OG_FONTS:[]},"~~/lib/live-view":live,"~~/lib/live-view-shares":shares,"~~/lib/live-view-data":{loadLiveView:()=>{throw Error("Snapshot images cannot read live data");}},"~~/utils/reportServerError":{withErrorReporting:(_:unknown,fn:unknown)=>fn,reportServerError:()=>{}}});
 for(const [format,height] of [["farcaster.png",800],["x.png",600]]){
  const response=await route.GET({nextUrl:new URL("https://example.com"+path)},{params:Promise.resolve({format})});assert.equal(response.status,200);assert.equal(response.headers.get("test-height"),String(height));assert.match(response.headers.get("cache-control"),/immutable/);
  const text=await response.text();for(const label of Object.values(live.liveMetricLabels))assert.ok(text.includes(label));assert.ok(text.includes("50"));assert.ok(text.includes("12:30:00"));assert.doesNotMatch(text,/99,999|01:00:00/);
 }
 assert.equal(reads,1);await assert.rejects(()=>shares.readLiveShare(snapshot.id,{type:"like"}),/do not match/);await assert.rejects(()=>shares.readLiveShare("f".repeat(64),{type:"all"}),/not found/);
 for(const bad of [{user:0},{type:"constructor"},{user:"0"}])await assert.rejects(()=>shares.createLiveShare(bad));
 for(const query of ["share=bad","share="+snapshot.id+"&share="+snapshot.id])assert.throws(()=>live.liveSelection(new URLSearchParams(query)));
});
test("daily totals count DAU across all actions and keep exact UTC cutoff",async()=>{
 const sqls:string[]=[];
 const data=moduleFrom("lib/live-view-data.ts",{"server-only":{},"next/cache":{unstable_cache:(fn:unknown)=>fn},"~~/lib/clickhouse":{query:async(sql:string)=>{sqls.push(sql);if(sql.includes(" AS dau"))return[{day:new Date().toISOString().slice(0,10),casts:1,replies:0,recasts:0,likes:1,dau:2}];if(sql.includes("dataset_status"))return[{current_state_is_ready:1}];return[];}},"~~/lib/data":{resolveAccount:async(v:string)=>v},"~~/lib/profile-data":{loadProfiles:async()=>[]},"~~/lib/activity":await import("../packages/nextjs/lib/activity.ts"),"~~/lib/live-view":live});
 const result=await data.loadLiveView({type:"all"});assert.equal(result.totals.today.dau,2);assert.equal(result.totals.yesterday.dau,0);assert.match(result.totals.asOf,/T\d{2}:\d{2}:\d{2}\.000Z$/);
 const aggregate=sqls.find(sql=>sql.includes(" AS dau"))!;assert.match(aggregate,/uniqExactIf\(fid,fid>0\)/);assert.doesNotMatch(aggregate,/WHERE[^;]*action_type IN/);assert.match(aggregate,/timestamp <= toDateTime\(\{asOf:UInt32\}/);
});


test("Live View enriches quote-recasts through existing bounded message keys and retains unavailable references",async()=>{
 const ownHash="a".repeat(40), quoteHash="b".repeat(40), quotedFid="18446744073709551615";
 let available=true;
 const queries:string[]=[];
 const data=moduleFrom("lib/live-view-data.ts",{
  "server-only":{},"next/cache":{unstable_cache:(fn:unknown)=>fn},
  "~~/lib/clickhouse":{query:async(sql:string,params:any)=>{
   queries.push(sql);
   if(sql.includes(" AS dau"))return [];
   if(sql.includes("dataset_status"))return [{current_state_is_ready:1}];
   if(sql.includes(" AS mentions"))return [{actor:"366713",hash:ownHash,mentions:[],quotes:[[quotedFid,JSON.stringify({type:"Buffer",data:Array(20).fill(187)})]]}];
   if(sql.includes(" AS text")){assert.ok(params.quotes.includes(quotedFid));assert.ok(params.removed.includes(quoteHash));return available?[{actor:quotedFid,hash:quoteHash,text:"Original quoted cast"}]:[];}
   return [{ts:Math.floor(Date.now()/1000),hash:"0x"+ownHash,actor:"366713",action_type:"cast",body:"My quote",parent:null,target:null,parent_hash:null,target_hash:null}];
  }},"~~/lib/data":{resolveAccount:async(v:string)=>v},"~~/lib/profile-data":{loadProfiles:async(fids:string[])=>{assert.ok(fids.includes(quotedFid));return [{fid:quotedFid,username:"quoted-caster",display_name:null}];}},"~~/lib/activity":await import("../packages/nextjs/lib/activity.ts"),"~~/lib/live-view":live,
 });
 const first=await data.loadLiveView({type:"cast"});
 assert.equal(first.events[0].action,"cast");assert.equal(first.events[0].castHash,"0x"+ownHash);
 assert.equal(first.events[0].quotes[0].author.fid,quotedFid);assert.equal(first.events[0].quotes[0].hash,"0x"+quoteHash);assert.equal(first.events[0].quotes[0].text,"Original quoted cast");
 assert.ok(queries.some(sql=>sql.includes("embeds_json")));
 const contextQuery=queries.find(sql=>sql.includes(" AS text"))!;assert.match(contextQuery,/PREWHERE \(fid,type,hash\) IN/);assert.match(contextQuery,/cast_removals/);assert.match(contextQuery,/timestamp <= \{asOf:UInt32\}/);
 available=false;const missing=await data.loadLiveView({type:"cast"});assert.equal(missing.events.length,1);assert.equal(missing.events[0].quotes[0].text,null);
});

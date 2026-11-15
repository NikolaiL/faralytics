import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as casters from "../packages/nextjs/lib/top-casters.ts";
import { InputError } from "../packages/nextjs/lib/activity.ts";
const require = createRequire(new URL("../packages/nextjs/package.json", import.meta.url));
const ts = require("typescript");
function moduleFrom(path: string, mocks: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL("../packages/nextjs/"+path, import.meta.url),"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const module = {exports:{} as any};
  runInNewContext(code, {module,exports:module.exports,require:(id: string) => Object.hasOwn(mocks,id) ? mocks[id] : require(id),Buffer,URL,URLSearchParams,Response,console});
  return module.exports;
}
function words(node: any): string {
  if(node == null || typeof node === "boolean") return "";
  if(Array.isArray(node)) return node.map(words).join(" ");
  if(typeof node === "object") return words(node.props?.children);
  return String(node);
}
test("all category shares persist one source for text and both OG formats, even after live rankings change", async () => {
  let latest: casters.TopCasters;
  let reads=0;
  const stored = new Map<string, unknown>();
  const db = async (parts: TemplateStringsArray, ...values: any[]) => {
    if(parts[0].startsWith("INSERT")) { if(!stored.has(values[0])) stored.set(values[0], JSON.parse(values[1])); return []; }
    return stored.has(values[0]) ? [{payload:stored.get(values[0])}] : [];
  };
  const shares = moduleFrom("lib/top-caster-shares.ts", {
    "server-only":{}, "~~/utils/db":{getDb:()=>db}, "~~/lib/activity":{InputError}, "~~/lib/top-casters":casters,
    "~~/lib/top-casters-data":{loadTopCasters:async()=>{reads++;return latest;}},
  });
  const og = moduleFrom("components/TopCastersOg.tsx", {
    "server-only":{}, "~~/components/OgLogo":{OgLogo:()=>null}, "~~/lib/avatar":{loadAvatar:async()=>null},
    "~~/lib/top-casters":casters, "~~/lib/top-casters-data":{loadTopCasters:async()=>{throw Error("Live rankings must never be queried for a snapshot image");}},
  });
  const route = moduleFrom("app/api/og/top-casters/[format]/route.tsx", {
    "next/og":{ImageResponse:class extends Response { constructor(tree:any) { super(words(tree)); } }},
    "~~/components/TopCastersOg":og, "~~/lib/activity":{InputError}, "~~/lib/og-fonts":{OG_FONTS:[]},
    "~~/lib/top-casters":casters,"~~/lib/top-caster-shares":shares,
    "~~/utils/reportServerError":{withErrorReporting:(_:unknown,fn:unknown)=>fn,reportServerError:()=>{}},
  });
  for(const metric of casters.casterMetricOrder) {
    latest={start:"2026-11-15",through:"2026-11-15",updatedAt:"snapshot time",checkedAt:null,catchingUp:false,partialDay:true,coverage:"incomplete",profiles:[],lists:[{metric,userPosition:19,rows:[1,2,3,17,18,19,20,21].map(position=>({position,fid:position===19?"366713":String(position),score:1000-position}))}]};
    latest.profiles=latest.lists[0].rows.map(row=>({fid:row.fid,username:"user"+row.fid,display_name:null}));
    const snapshot = await shares.createCasterShare({metric,period:"today",user:"366713"});
    assert.match(snapshot.id,/^[a-f0-9]{64}$/);
    assert.equal(snapshot.selection.end,new Date().toISOString().slice(0,10));
    latest.lists[0].userPosition=217;
    latest.lists[0].rows[0].score=888888;
    // Read back persisted bytes rather than the mutable in-memory source.
    const frozen=await shares.readCasterShare(snapshot.id,snapshot.selection);
    const text=casters.casterShareText(frozen.selection,frozen.data,"farcaster","366713");
    assert.match(text,/I am ranked #19/);
    assert.match(text,/#1 @user1 999/);
    assert.doesNotMatch(text,/Top Casters|888,888|#217/);
    const path=casters.casterPath(frozen.selection,undefined,frozen.id);
    assert.ok(!path.includes("end="));
    for(const format of ["farcaster.png","x.png"]) {
      const response = await route.GET({nextUrl:new URL("https://example.com/api/og"+path.slice(path.indexOf("?")))},{params:Promise.resolve({format})});
      assert.equal(response.status,200);
      const image=await response.text();
      assert.ok(image.includes(casters.casterTitle(metric,"today")));
      assert.ok(image.includes("999"));
      assert.ok(image.includes("#19"));
      assert.doesNotMatch(image,/888,888|Top Casters/);
    }
    await assert.rejects(()=>shares.readCasterShare(snapshot.id,{...snapshot.selection,user:"3"}),/do not match/);
  }
  assert.equal(reads,9,"only share creation reads rankings");
  await assert.rejects(()=>shares.readCasterShare("a".repeat(64),{}),/not found/);
  for(const input of [{},{metric:"constructor",period:"today"},{metric:"casts",period:"today",user:"0"}]) await assert.rejects(()=>shares.createCasterShare(input));
});

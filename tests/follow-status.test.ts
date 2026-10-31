import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveFollowStatus, readSnapchainFollow, readPublicFollow, CREATOR_FID } from "../packages/nextjs/lib/follow-status.ts";
const mock = (handler: (url: URL) => Response | Promise<Response>) => ((input: string | URL | Request) => handler(new URL(String(input)))) as typeof fetch;
test("follow checks use database then own node then public, stop on positives and never turn errors into non-follow",async()=>{
 const calls:string[]=[];const read=(name:string,value:boolean|Error)=>async()=>{calls.push(name);if(value instanceof Error)throw value;return value;};
 const database=read('db',false),snapchain=read('own',false),publicRead=read('public',true);
 const result=await resolveFollowStatus('10956',{database,snapchain,public:publicRead});assert.equal(result.following,true);assert.equal(result.source,'public');assert.deepEqual(calls,['db','own','public']);
 calls.length=0;assert.equal((await resolveFollowStatus('10956',{database:read('db',true),snapchain,public:publicRead})).source,'clickhouse');assert.deepEqual(calls,['db']);
 calls.length=0;assert.equal((await resolveFollowStatus('10956',{database:read('db',new Error('timeout')),snapchain:read('own',true),public:publicRead})).source,'snapchain');assert.deepEqual(calls,['db','own']);
 const negative=await resolveFollowStatus('3',{database,snapchain,public:read('public',false)});assert.equal(negative.following,false);assert.equal(negative.attempts.length,3);
 const unknown=await resolveFollowStatus('3',{database,snapchain,public:read('public',new Error('timeout'))});assert.equal(unknown.following,null);
 calls.length=0;assert.equal((await resolveFollowStatus(CREATOR_FID,{database,snapchain,public:publicRead})).source,'self');assert.deepEqual(calls,[]);
 await assert.rejects(()=>resolveFollowStatus('0',{database,snapchain,public:publicRead}));
});
test("own Snapchain reads validate follow direction, target, message type, and explicit not-found",async()=>{
 const message={data:{type:'MESSAGE_TYPE_LINK_ADD',fid:10956,linkBody:{type:'follow',targetFid:366713}}};
 assert.equal(await readSnapchainFollow('10956','http://65.21.162.140:3381',mock(url=>{assert.equal(url.searchParams.get('fid'),'10956');assert.equal(url.searchParams.get('target_fid'),CREATOR_FID);return Response.json(message);})),true);
 assert.equal(await readSnapchainFollow('3','http://65.21.162.140:3381',mock(()=>Response.json({error:'Failed',error_detail:'status: NotFound, message: cast not found'},{status:400}))),false);
 for(const body of [{data:{...message.data,fid:366713}}, {data:{...message.data,linkBody:{type:'follow',targetFid:3}}},{}])await assert.rejects(()=>readSnapchainFollow('10956','http://65.21.162.140:3381',mock(()=>Response.json(body))));
 await assert.rejects(()=>readSnapchainFollow('3','http://65.21.162.140:3381',mock(()=>new Response('html',{status:200}))));
});
test("public following lookup traverses cursor pages, completes negatives, and rejects partial or repeated cursors",async()=>{
 let calls=0;assert.equal(await readPublicFollow('10956',mock(url=>{calls++;assert.equal(url.searchParams.get('fid'),'10956');assert.equal(url.searchParams.get('limit'),'50');if(!url.searchParams.has('cursor'))return Response.json({result:{users:[{fid:3}]},next:{cursor:'next'}});assert.equal(url.searchParams.get('cursor'),'next');return Response.json({result:{users:[{fid:366713}]}});})),true);assert.equal(calls,2);
 assert.equal(await readPublicFollow('3',mock(()=>Response.json({result:{users:[]}}))),false);
 await assert.rejects(()=>readPublicFollow('3',mock(()=>Response.json({result:{users:[]},next:{cursor:'repeat'}}))));
 await assert.rejects(()=>readPublicFollow('3',mock(()=>Response.json({result:{users:[{fid:0}]}}))));
 await assert.rejects(()=>readPublicFollow('3',mock(()=>new Response('down',{status:503}))));
 calls=0;await assert.rejects(()=>readPublicFollow('3',mock(()=>Response.json({result:{users:[]},next:{cursor:String(++calls)}}))));assert.equal(calls,30);
});

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium, expect } = require('@playwright/test');
require('../packages/nextjs/node_modules/@next/env').loadEnvConfig(process.cwd()+'/packages/nextjs');
const {neon} = require('../packages/nextjs/node_modules/@neondatabase/serverless');
const sql=neon(process.env.DATABASE_URL);
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});const ids=[];
 try {
  const context=await browser.newContext(); const page=await context.newPage();
  const id=randomUUID();ids.push(id);const body={lookupId:id,tool:'activity',fids:['366713'],period:'365',end:'2026-10-30'};
  const headers={Origin:'http://localhost:3100','x-farcaster-fid':'3','x-vercel-forwarded-for':'203.0.113.7'};
  assert.equal((await context.request.get('http://localhost:3100/api/health/db')).status(),200);
  for(const [h,b,status]of[[{},body,403],[{Origin:'https://evil.example'},body,403],[headers,{...body,tool:'unknown'},400],[headers,{...body,fids:['0']},400],[{...headers,Authorization:'Bearer fake'},body,401]]){
    const r=await context.request.post('http://localhost:3100/api/lookup-log',{headers:h,data:b});assert.equal(r.status(),status);
  }
  for(let i=0;i<2;i++){const r=await context.request.post('http://localhost:3100/api/lookup-log',{headers,data:body});assert.equal(r.status(),200,await r.text());}
  assert.equal((await context.request.post('http://localhost:3100/api/lookup-log',{headers,data:{...body,fids:['366713','10956']}})).status(),200);
  let rows=await sql`SELECT * FROM lookup_log WHERE lookup_id=${id}::uuid ORDER BY position`;
  assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.viewed_fid),['366713','10956']);assert.equal(rows[0].viewer_fid,null);assert.equal(rows[0].viewer_ip,null);assert.match(rows[0].user_id,/^anon:/);assert.equal(rows[0].identity_source,'anonymous');
  const id2=randomUUID();ids.push(id2);assert.equal((await context.request.post('http://localhost:3100/api/lookup-log',{headers,data:{...body,lookupId:id2,tool:'followers',period:'all'}})).status(),200);
  const second=await sql`SELECT user_id FROM lookup_events WHERE lookup_id=${id2}::uuid`;assert.equal(second[0].user_id,rows[0].user_id,'anonymous cookie stable between tools');
  await Promise.all(['3','4'].map(async fid=>{const r=await context.request.post('http://localhost:3100/api/lookup-log',{headers,data:{...body,lookupId:id2,tool:'followers',period:'all',fids:['366713',fid]}});assert.equal(r.status(),200);}));
  const concurrent=await sql`SELECT fid::text, position FROM lookup_accounts WHERE lookup_id=${id2}::uuid ORDER BY position`;assert.equal(concurrent.length,3);assert.equal(new Set(concurrent.map(r=>r.position)).size,3);
  const stranger=await browser.newContext();assert.equal((await stranger.request.post('http://localhost:3100/api/lookup-log',{headers,data:{...body,lookupId:id2,tool:'followers',period:'all',fids:['37']}})).status(),409);await stranger.close();
  await page.goto('http://localhost:3100/');await page.waitForTimeout(400);
  let requestBody;page.on('request',request=>{if(request.url().endsWith('/api/lookup-log')){const data=request.postDataJSON();if(data){requestBody=data;ids.push(data.lookupId);}}});
  await page.goto('http://localhost:3100/followers?fids=366713');await expect.poll(()=>requestBody?.tool).toBe('followers');assert.deepEqual(requestBody.fids,['366713']);
  const chartSession=requestBody.lookupId;
  await expect.poll(async()=>{const r=await sql`SELECT count(*)::int AS n FROM lookup_accounts WHERE lookup_id=${chartSession}::uuid`;return r[0].n;}).toBe(1);
  await page.getByTestId('followers-input').fill('10956');await page.getByTestId('followers-submit').click();await expect.poll(()=>requestBody?.fids.length).toBe(2);assert.equal(requestBody.lookupId,chartSession);

  await expect.poll(async()=>{const r=await sql`SELECT count(*)::int AS n FROM lookup_accounts WHERE lookup_id=${requestBody.lookupId}::uuid`;return r[0].n;}).toBe(2);
  await page.getByTestId('follower-remove-10956').click();await expect(page.locator('.recharts-line-curve')).toHaveCount(1);await page.getByTestId('followers-input').fill('10956');await page.getByTestId('followers-submit').click();await expect(page.locator('.recharts-line-curve')).toHaveCount(2);await page.waitForTimeout(500);
  const original=await sql`SELECT count(*)::int AS n FROM lookup_accounts WHERE lookup_id=${chartSession}::uuid`;assert.equal(original[0].n,2,'re-adding FID is not counted twice');
  await page.getByTestId('followers-reset').click();requestBody=undefined;await page.getByTestId('followers-input').fill('366713');await page.getByTestId('followers-submit').click();await expect.poll(()=>requestBody?.fids.length).toBe(1);assert.notEqual(requestBody.lookupId,chartSession,'clear starts a new chart session');
  await page.getByTestId('followers-input').fill('10956');await page.getByTestId('followers-submit').click();await expect.poll(()=>requestBody?.fids.length).toBe(2);
  requestBody=undefined;await page.getByTestId('tab-activity').click();await expect.poll(()=>requestBody?.tool).toBe('activity');assert.deepEqual(requestBody.fids,['366713','10956']);
  await expect.poll(async()=>{const r=await sql`SELECT count(*)::int AS n FROM lookup_accounts WHERE lookup_id=${requestBody.lookupId}::uuid`;return r[0].n;}).toBe(2);
  console.log('PASS lookup logging: real Neon writes, chart session extension/reset, concurrent append/order/idempotency, anonymous identity across tools, spoofed identity rejection, same-origin validation, health, and client tracking for both views.');
 }finally{await browser.close();if(ids.length)await sql`DELETE FROM lookup_events WHERE lookup_id=ANY(${ids}::uuid[])`;}
})().catch(error=>{console.error('Lookup integration check failed:',error.name,String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));process.exit(1)});

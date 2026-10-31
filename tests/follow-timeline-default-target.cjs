const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const base=process.env.BASE_URL || 'http://localhost:3100';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 try {
  async function setup(path,delay=30,miniapp=true){
   const page=await browser.newPage({viewport:{width:390,height:850}}),requests=[];
   await page.route('https://faralytics.vercel.app/**',async route=>{const u=new URL(route.request().url());const response=await fetch(base+u.pathname+u.search);await route.fulfill({status:response.status,headers:Object.fromEntries([...response.headers].filter(([k])=>!['content-encoding','content-length','transfer-encoding'].includes(k))),body:Buffer.from(await response.arrayBuffer())});});
   const profile=fid=>({fid,username:fid==='10956'?'viewer':'user'+fid,display_name:null,pfp_url:null});
   await page.route('**/api/follow-timeline?*',route=>{const p=new URL(route.request().url()).searchParams;requests.push(p.toString());return route.fulfill({json:{events:[],filters:{actor:p.get('actor')?profile(p.get('actor')):null,target:p.get('target')?profile(p.get('target')):null},headCursor:null,nextCursor:null,hasMore:false,updatedAt:new Date().toISOString()}});});
   await page.route('**/api/lookup-log',r=>r.fulfill({json:{}}));
   await page.route('**/api/follow-status',r=>r.fulfill({json:{following:true,viewerFid:'10956',targetFid:'366713'}}));
   await page.route('https://auth.farcaster.xyz/nonce',r=>r.fulfill({json:{nonce:'testnonce123'}}));
   await page.route('https://auth.farcaster.xyz/verify-siwf',r=>r.fulfill({json:{token:'e30.'+Buffer.from(JSON.stringify({sub:10956,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.mock'}}));
   if(miniapp)await page.addInitScript(({delay})=>{window.__addCalls=0;window.ReactNativeWebView={postMessage:raw=>{const req=JSON.parse(raw);let value,wait=20;if(req.path?.[0]==='context'){wait=delay;value={user:{fid:10956},client:{clientFid:9152,added:false,safeAreaInsets:{top:0,bottom:0,left:0,right:0}}};}else if(req.path?.[0]==='getCapabilities')value=['actions.addMiniApp'];else if(req.path?.[0]==='addFrame'){window.__addCalls++;value={error:{type:'rejected_by_user'}};}else if(req.path?.[0]==='signIn')value={result:{message:'faralytics.vercel.app wants you to sign in with your Ethereum account:\n0x8D6230427a37986D25Fe4D5B3d0aaEF1b924fEd6\n\nFarcaster Auth\n\nURI: https://faralytics.vercel.app\nVersion: 1\nChain ID: 10\nNonce: testnonce123\nIssued At: 2026-10-31T00:00:00.000Z',signature:'0x1234'}};setTimeout(()=>document.dispatchEvent(new MessageEvent('FarcasterFrameCallback',{data:{id:req.id,type:'RAW',value}})),wait);}};},{delay});
   await page.goto('https://faralytics.vercel.app'+path);
   return {page,requests};
  }
  const cold=await setup('/follow-timeline',2000);
  await cold.page.waitForTimeout(300);assert.equal(cold.requests.length,0,'wait for cold host identity instead of querying everyone');
  await expect(cold.page.getByTestId('timeline-target-input')).toHaveValue('@viewer');
  assert.ok(cold.requests.every(q=>new URLSearchParams(q).get('target')==='10956'));
  await expect(cold.page.getByTestId('follow-gate')).not.toBeVisible();
  assert.equal(await cold.page.evaluate(()=>window.__addCalls),0,'automatic self-target is not meaningful interaction');
  await cold.page.getByTestId('timeline-clear').click();
  await expect(cold.page.getByTestId('timeline-target-input')).toHaveValue('');
  await expect.poll(()=>cold.requests.at(-1)).toBe('');
  await expect(cold.page.getByTestId('follow-gate')).not.toBeVisible();
  const before=cold.requests.length;await cold.page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect.poll(()=>cold.requests.length).toBeGreaterThan(before);assert.equal(cold.requests.at(-1),'','clearing remains unfiltered on refresh');
  for(const role of ['actor','target']){
   const other=role==='actor'?'target':'actor';
   await cold.page.getByRole('form',{name:`Filter by ${role}`}).getByTestId('show-me').click();
   await expect(cold.page.getByTestId(`timeline-${role}-input`)).toHaveValue('@viewer');
   await expect(cold.page.getByTestId(`timeline-${other}-input`)).toHaveValue('');
   await expect.poll(()=>cold.requests.at(-1)).toBe(role+'=10956');
  }
  await cold.page.close();
  for(const query of ['target=37','actor=3','actor=3&target=37']){
   const explicit=await setup('/follow-timeline?'+query);
   await explicit.page.getByTestId('add-miniapp').waitFor();
   await expect(explicit.page.getByTestId('timeline-target-input')).toHaveValue(query.includes('target')?'@user37':'');
   if(query.includes('actor'))await expect(explicit.page.getByTestId('timeline-actor-input')).toHaveValue('@user3');
   assert.ok(explicit.requests.length>0);for(const request of explicit.requests)assert.equal(new URLSearchParams(request).toString(),new URLSearchParams(query).toString(),'explicit filters preserved');
   await explicit.page.close();
  }
  const global=await setup('/follow-timeline?all=1');
  await expect(global.page.getByText('No captured events yet')).toBeVisible();
  assert.ok(global.requests.every(q=>q===''),'explicit global share remains global inside Farcaster');
  await expect.poll(()=>new URL(global.page.url()).searchParams.get('all')).toBe('1');
  await global.page.reload();await expect(global.page.getByText('No captured events yet')).toBeVisible();assert.ok(global.requests.every(q=>q===''));await global.page.close();
  const web=await setup('/follow-timeline',0,false);await expect(web.page.getByText('No captured events yet')).toBeVisible();assert.equal(web.requests[0],'');await expect(web.page.getByTestId('show-me')).toHaveCount(0);await expect(web.page.getByTestId('timeline-target-input')).toHaveValue('');await expect(web.page.getByTestId('follow-gate')).toHaveCount(0);await web.page.close();
  console.log('PASS timeline default target: cold Farcaster self-target only, no automatic follow/add prompt, explicit filters preserved, clear stays global after refresh, browser default global, Show me uses viewer in either field and clears duplicate opposite selection, no Show me outside Farcaster. No native social action sent.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const base='http://localhost:3100';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 try {
  // Exercise actual ClickHouse queries, keyset paging and validation before mocking the UI.
  const timings=[];
  for(const selection of ['', 'actor=366713','target=366713','actor=3318053&target=366713']){
   const start=Date.now();const r=await fetch(base+'/api/follow-timeline?'+selection);assert.equal(r.status,200);const p=await r.json();timings.push({selection:selection||'everyone',ms:Date.now()-start,count:p.events.length});assert.ok(p.events.length<=20);assert.equal(new Set(p.events.map(e=>e.id)).size,p.events.length);assert.ok(p.events.every(e=>['follow','unfollow'].includes(e.action)));
   const params=new URLSearchParams(selection);if(params.has('actor'))assert.ok(p.events.every(e=>e.actor.fid===params.get('actor')));if(params.has('target'))assert.ok(p.events.every(e=>e.target.fid===params.get('target')));
   if(p.hasMore){const older=await(await fetch(base+'/api/follow-timeline?'+selection+'&before='+encodeURIComponent(p.nextCursor))).json();assert.ok(older.events.every(e=>!p.events.some(old=>old.id===e.id)));assert.ok(older.events.every(e=>e.timestamp<=p.events.at(-1).timestamp));}
   if(p.headCursor){const newer=await(await fetch(base+'/api/follow-timeline?'+selection+'&after='+encodeURIComponent(p.headCursor))).json();assert.ok(newer.events.every(e=>e.timestamp>=p.events[0].timestamp));}
  }
  for(const query of ['actor=0','target=18446744073709551616','after=bad','actor=1&actor=2'])assert.equal((await fetch(base+'/api/follow-timeline?'+query)).status,400);
  console.log('PASS live timeline API: all/actor/target/both, both cursor directions, deduplication, invalid input.',JSON.stringify(timings));
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  const now=Date.now();await page.clock.install({time:new Date(now)});
  const alice={fid:'1',username:'alice',display_name:'Alice',pfp_url:'https://example.com/avatar.png'};
  const bob={fid:'2',username:'bob',display_name:'Bob',pfp_url:'https://example.com/avatar.png'};
  const event=n=>({id:'0x'+n.toString(16).padStart(40,'0'),cursor:`${Math.floor((now-100000)/1000)+n}:0x${n.toString(16).padStart(40,'0')}`,timestamp:new Date(Math.floor((now-100000)/1000)*1000+n*1000).toISOString(),action:n%2?'follow':'unfollow',actor:alice,target:bob});
  let latest=95,failOlder=false,failRefresh=false,empty=false,requests=[];
  await page.route('**/api/lookup-log',r=>r.fulfill({json:{}}));
  await page.route('https://example.com/avatar.png',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#855dcd"/></svg>'}));
  await page.route('**/api/search?*',r=>r.fulfill({json:[{...alice,followerCount:1000},{...bob,followerCount:100}]}));
  await page.route('**/api/follow-timeline?*',async r=>{
   const p=new URL(r.request().url()).searchParams;requests.push(p.toString());
   if((p.has('before')&&failOlder)||(p.has('after')&&failRefresh))return r.fulfill({status:503,json:{error:'Temporary outage'}});
   if(p.get('actor')==='missing')return r.fulfill({status:404,json:{error:'No account found'}});
   const filters={actor:p.has('actor')?(p.get('actor')==='2'?bob:alice):null,target:p.has('target')?(p.get('target')==='1'?alice:bob):null};
   let nums=empty?[]:Array.from({length:latest},(_,i)=>i+1);
   if(p.has('before'))nums=nums.filter(n=>event(n).cursor.split(':')[0]<p.get('before').split(':')[0]);
   if(p.has('after'))nums=nums.filter(n=>event(n).cursor.split(':')[0]>p.get('after').split(':')[0]);
   if(!p.has('after'))nums.reverse();const hasMore=nums.length>20;nums=nums.slice(0,20);if(p.has('after'))nums.reverse();const events=nums.map(event);
   return r.fulfill({json:{events,filters,headCursor:events[0]?.cursor||null,nextCursor:events.at(-1)?.cursor||null,hasMore,updatedAt:new Date(now).toISOString()}});
  });
  await page.goto(base+'/follow-timeline');await expect(page.getByTestId('timeline-event')).toHaveCount(20);
  await expect(page.getByTestId('tab-follow-timeline')).toHaveAttribute('aria-current','page');await expect(page.locator('.timeline-live')).toContainText('Live');
  await expect(page.locator('.timeline-avatar img').first()).toHaveJSProperty('naturalWidth',40);
  const firstTime=await page.locator('.timeline-row time').first().innerText();await page.clock.runFor(1000);assert.notEqual(await page.locator('.timeline-row time').first().innerText(),firstTime);
  const followColor=await page.locator('.is-follow .timeline-verb').first().evaluate(el=>getComputedStyle(el).color);const unfollowColor=await page.locator('.is-unfollow .timeline-verb').first().evaluate(el=>getComputedStyle(el).color);assert.notEqual(followColor,unfollowColor);
  latest=120;await page.clock.runFor(5000);await expect(page.getByTestId('timeline-event')).toHaveCount(40);await page.clock.runFor(500);await expect(page.getByTestId('timeline-event')).toHaveCount(45);assert.ok(await page.locator('.timeline-row').evaluateAll(els=>els.some(el=>el.getAnimations().length>0)),'new events animate');await page.evaluate(()=>document.getAnimations().forEach(animation=>animation.finish()));assert.equal(new Set(await page.getByTestId('timeline-event').evaluateAll(els=>els.map(el=>el.dataset.eventId))).size,45,'busy cursor batches have no overlaps');
  await page.getByTestId('timeline-pause').click();const paused=requests.length;await page.clock.runFor(6000);assert.equal(requests.length,paused,'pause stops live requests');
  await page.getByTestId('timeline-pause').click();await expect(page.locator('.timeline-live')).toContainText('Live');
  await page.evaluate(()=>Object.defineProperty(document,'hidden',{value:true,configurable:true}));const hidden=requests.length;await page.clock.runFor(6000);assert.equal(requests.length,hidden,'hidden pages do not poll');await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.evaluate(()=>window.scrollTo(0,700));const anchor=page.getByTestId('timeline-event').nth(8);const before=await anchor.boundingBox();latest=121;await page.clock.runFor(5000);await expect(page.getByTestId('timeline-new')).toBeVisible();await expect(page.getByTestId('timeline-event')).toHaveCount(45);assert.ok(Math.abs((await anchor.boundingBox()).y-before.y)<2,'reading position retained');
  await page.getByTestId('timeline-new').click();await page.clock.runFor(800);await expect(page.getByTestId('timeline-event')).toHaveCount(20);await expect(page.getByTestId('timeline-event').first()).toHaveAttribute('data-event-id',event(121).id);
  failRefresh=true;await page.clock.runFor(5000);await expect(page.getByTestId('timeline-feed').getByRole('alert')).toContainText('Could not refresh');await expect(page.getByTestId('timeline-event')).toHaveCount(20);failRefresh=false;await page.clock.runFor(5000);await expect(page.getByTestId('timeline-feed').getByRole('alert')).toHaveCount(0);
  failOlder=true;await page.getByTestId('timeline-more').scrollIntoViewIfNeeded();await expect(page.getByTestId('timeline-feed').getByRole('alert')).toContainText('Temporary outage');failOlder=false;await page.getByTestId('timeline-more').click();await expect(page.getByTestId('timeline-event')).toHaveCount(40);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.getByTestId('timeline-actor-input').fill('a');await page.clock.runFor(700);await expect(page.getByTestId('timeline-actor-result')).toHaveCount(2);await page.getByTestId('timeline-actor-result').first().click();await expect(page.getByTestId('timeline-actor-input')).toHaveValue('@alice');assert.equal(new URL(page.url()).searchParams.get('actor'),'1');
  await page.getByTestId('timeline-target-input').fill('bob');await page.clock.runFor(300);await page.getByTestId('timeline-target-result').nth(1).click();await expect(page.getByTestId('timeline-target-input')).toHaveValue('@bob');assert.equal(new URL(page.url()).searchParams.get('target'),'2');
  await page.getByTestId('timeline-actor-clear').click();await expect(page.getByTestId('timeline-actor-input')).toHaveValue('');await expect.poll(()=>new URL(page.url()).searchParams.get('actor')).toBe(null);await page.getByTestId('timeline-target-clear').click();await expect(page.getByTestId('timeline-target-input')).toHaveValue('');await expect.poll(()=>new URL(page.url()).search).toBe('');
  empty=true;await page.getByTestId('timeline-actor-input').fill('2');await page.getByTestId('timeline-actor-submit').click();await expect(page.getByText('No captured events yet')).toBeVisible();await page.getByTestId('timeline-actor-input').fill('draft');await page.clock.runFor(5000);await expect(page.getByTestId('timeline-actor-input')).toHaveValue('draft');
  empty=false;await page.getByTestId('timeline-actor-input').fill('1');await page.getByTestId('timeline-actor-submit').click();await expect(page.getByTestId('timeline-event')).toHaveCount(20);
  await page.getByTestId('timeline-actor-input').fill('missing');await page.getByTestId('timeline-actor-submit').click();await expect(page.getByTestId('timeline-feed').getByRole('alert')).toContainText('No account found');await page.getByTestId('timeline-clear').click();await expect(page.getByTestId('timeline-event')).toHaveCount(20);await expect.poll(()=>new URL(page.url()).search).toBe('');
  for(const width of [320,390,760,1280]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow '+width);for(const id of ['tab-activity','tab-followers','tab-follow-timeline']){const box=await page.getByTestId(id).boundingBox();assert.ok(box.width>50&&box.x>=0&&box.x+box.width<=width);}assert.equal(await page.getByTestId('timeline-actor-input').evaluate(el=>getComputedStyle(el).fontSize),'16px');}
  await page.setViewportSize({width:390,height:850});await page.clock.runFor(100);await page.screenshot({path:'artifacts/follow-timeline-mobile.png',fullPage:false});
  await page.setViewportSize({width:1280,height:850});await page.clock.runFor(100);await page.screenshot({path:'artifacts/follow-timeline-desktop.png',fullPage:false});
  await page.emulateMedia({reducedMotion:'reduce'});latest=122;await page.clock.runFor(5000);await expect(page.getByTestId('timeline-event')).toHaveCount(21);assert.equal(await page.locator('.timeline-row').evaluateAll(els=>els.flatMap(el=>el.getAnimations()).length),0);
  const host=await browser.newPage({viewport:{width:390,height:850}});
  await host.route('https://faralytics.vercel.app/**',async route=>{const url=new URL(route.request().url());const response=await fetch(base+url.pathname+url.search);await route.fulfill({status:response.status,headers:Object.fromEntries([...response.headers].filter(([k])=>!['content-encoding','content-length','transfer-encoding'].includes(k))),body:Buffer.from(await response.arrayBuffer())});});
  await host.route('**/api/follow-timeline?*',r=>r.fulfill({json:{events:Array.from({length:20},(_,i)=>event(95-i)),filters:{actor:null,target:null},headCursor:event(95).cursor,nextCursor:event(76).cursor,hasMore:true,updatedAt:new Date().toISOString()}}));
  await host.route('**/api/lookup-log',r=>r.fulfill({json:{}}));
  await host.addInitScript(()=>{window.__profileCalls=0;window.ReactNativeWebView={postMessage:raw=>{const req=JSON.parse(raw);let value;if(req.path?.[0]==='context')value={user:{fid:366713},client:{clientFid:9152,added:true,safeAreaInsets:{top:0,bottom:22,left:0,right:0}}};else if(req.path?.[0]==='getCapabilities')value=['actions.viewProfile'];else if(req.path?.[0]==='viewProfile')window.__profileCalls++;setTimeout(()=>document.dispatchEvent(new MessageEvent('FarcasterFrameCallback',{data:{id:req.id,type:'RAW',value}})),20);}};});
  await host.goto('https://faralytics.vercel.app/follow-timeline');await expect(host.getByTestId('timeline-event')).toHaveCount(20);await expect.poll(()=>host.locator('.app-navigation').evaluate(el=>getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom'))).toContain('22px');await host.locator('.timeline-account').first().click();assert.equal(await host.evaluate(()=>window.__profileCalls),1);assert.equal(new URL(host.url()).pathname,'/follow-timeline');await expect(host.getByTestId('follow-gate')).toHaveCount(0);await host.close();
  console.log('PASS timeline UI: 20 initially, live batch catch-up, pause/resume, scroll-safe buffer, refresh recovery, lazy paging/retry, shared autocomplete/clear, empty state, 1s times, PFPs, action colors, mobile navigation and reduced motion. No social actions sent.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

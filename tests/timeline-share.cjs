const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,expect}=require('@playwright/test');
const sharp=require(process.cwd()+'/packages/nextjs/node_modules/sharp');
const base=process.env.BASE_URL||'http://localhost:3100';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 try{
  const page=await browser.newPage({viewport:{width:390,height:850}});
  const ts=Date.now().toString();
  const params=new URLSearchParams({target:'366713',ts});
  const response=await page.request.get(base+'/api/follow-timeline/share?'+params);
  assert.equal(response.status(),200,await response.text());const data=await response.json();
  assert.equal(data.filters.target.fid,'366713');assert.equal(data.events.length,10);
  assert.equal(new Set(data.events.map(e=>e.actor.fid)).size,10);
  assert.ok(data.events.every(e=>e.action==='follow'&&e.target.fid==='366713'&&Date.parse(e.timestamp)<=Number(ts)));
  assert.deepEqual(data.events.map(e=>e.timestamp),data.events.map(e=>e.timestamp).sort().reverse());
  for(const q of ['target=0','target=366713&ts=no','ts=1609459199999','ts='+(Date.now()+120000)])assert.equal((await page.request.get(base+'/api/follow-timeline/share?'+q)).status(),400,q);
  fs.mkdirSync('artifacts/timeline-og-samples',{recursive:true});
  for(const [mode,selection]of [['target',{target:'366713'}],['actor',{actor:'366713'}],['both',{actor:'3318053',target:'366713'}],['global',{}],['empty',{target:'366713',ts:'1609459200000'}]]){
   const p=new URLSearchParams({ts,...selection});
   const r=await page.request.get(base+'/api/follow-timeline/share?'+p);assert.equal(r.status(),200,mode);const share=await r.json();
   assert.ok(share.events.length<=10);assert.ok(share.events.every(e=>e.action==='follow'));
   if(selection.actor)assert.ok(share.events.every(e=>e.actor.fid===selection.actor));
   if(selection.target)assert.ok(share.events.every(e=>e.target.fid===selection.target));
   if(mode==='actor')assert.equal(new Set(share.events.map(e=>e.target.fid)).size,share.events.length);
   if(mode==='empty')assert.equal(share.events.length,0);
   for(const [format,height]of [['farcaster',800],['x',600]]){
    const image=await page.request.get(base+`/api/og/follow-timeline/${format}.png?`+p,{timeout:60000});assert.equal(image.status(),200,`${mode} ${format}: ${image.status()===200?'':await image.text()}`);
    const bytes=await image.body(),info=await sharp(bytes).metadata();assert.equal(info.width,1200);assert.equal(info.height,height);
    fs.writeFileSync(`artifacts/timeline-og-samples/${mode}-${format}.png`,bytes);
   }
  }
  assert.equal((await page.request.get(base+'/api/og/follow-timeline/bad.png')).status(),404);
  const crawler=await page.request.get(base+'/follow-timeline?'+params,{headers:{'User-Agent':'Twitterbot/1.0'}});
  assert.equal(crawler.status(),200);const html=await crawler.text();
  for(const marker of ['og:image','twitter:image','fc:miniapp','Check My Faralytics','/api/og/follow-timeline/farcaster.png','/api/og/follow-timeline/x.png','ts='+ts])assert.ok(html.includes(marker),marker);
  await page.addInitScript(()=>{
   window.__popups=[];window.open=()=>{const p={location:{href:''},close(){this.closed=true;}};window.__popups.push(p);return p;};
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text;}}});
  });
  await page.route('**/api/follow-timeline?*',r=>r.fulfill({json:{events:[],filters:{actor:null,target:data.filters.target},headCursor:null,nextCursor:null,hasMore:false,updatedAt:data.generatedAt}}));
  let fail=false;
  await page.route('**/api/follow-timeline/share?*',r=>r.fulfill({status:fail?502:200,json:fail?{error:'Please retry sharing.'}:data}));
  await page.route('**/api/lookup-log',r=>r.fulfill({json:{}}));
  await page.goto(base+'/follow-timeline?target=366713');
  await expect(page.getByTestId('share-farcaster')).toBeEnabled();
  for(const [name,format,height]of [['Farcaster · 3:2','farcaster',800],['X · 2:1','x',600]]){
   await page.getByRole('button',{name,exact:true}).click();const image=page.locator('.chart-image-preview img');
   await expect.poll(()=>image.evaluate(el=>el.naturalHeight)).toBe(height);
   const source=new URL(await image.getAttribute('src'),base);assert.equal(source.pathname,`/api/og/follow-timeline/${format}.png`);assert.equal(source.searchParams.get('target'),'366713');assert.match(source.searchParams.get('ts'),/^\d{13}$/);
   const before=await image.getAttribute('src');await page.waitForTimeout(1100);assert.equal(await image.getAttribute('src'),before,'clock updates do not reload previews');
   await page.getByRole('button',{name:'Close preview ×'}).click();await expect(page.locator('.chart-image-preview')).toHaveCount(0);
  }
  assert.equal(await page.locator('.image-links a[download]').count(),0,'timeline previews inline in web mode');
  await page.route('**/api/og/follow-timeline/*.png?*',r=>r.fulfill({status:502,body:'image unavailable'}));
  await page.getByRole('button',{name:'Farcaster · 3:2',exact:true}).click();await expect(page.locator('.chart-image-preview [role=alert]')).toContainText('Could not load');await page.getByRole('button',{name:'Close preview ×'}).click();
  await page.unroute('**/api/og/follow-timeline/*.png?*');
  await page.getByRole('button',{name:'Farcaster · 3:2',exact:true}).click();await expect.poll(()=>page.locator('.chart-image-preview img').evaluate(el=>el.naturalHeight)).toBe(800);await page.getByRole('button',{name:'Close preview ×'}).click();
  for(const width of [320,390,760,1280]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no overflow '+width);}
  await page.getByTestId('copy-link').click();await expect(page.getByText('link copied',{exact:true})).toBeVisible();
  const copied=new URL(await page.evaluate(()=>window.__copied));assert.equal(copied.pathname,'/follow-timeline');assert.equal(copied.searchParams.get('target'),'366713');assert.match(copied.searchParams.get('ts'),/^\d{13}$/);
  for(const [button,credit]of [['share-farcaster','@nikolaii.eth with @viniapp'],['share-x-bottom','@NikolaiLeb with @viniapp_xyz']]){
   await page.getByTestId(button).click();await expect.poll(()=>page.evaluate(()=>window.__popups.at(-1)?.location.href)).toContain('text=');
   const url=new URL(await page.evaluate(()=>window.__popups.at(-1).location.href));const text=url.searchParams.get('text');
   assert.ok(text.startsWith('Latest followers of @nikolaii.eth'));assert.ok(text.includes('\n\nCheck Yours\n\n'));assert.ok(text.endsWith(credit));
   for(const event of data.events)if(event.actor.username)assert.ok(!text.split('\n\n')[0].includes('@'+event.actor.username));
   assert.ok(url.searchParams.get('url')||url.searchParams.get('embeds[]'));
  }
  for(const filters of [{actor:data.filters.target,target:null},{actor:data.filters.target,target:{...data.filters.target,fid:'37'}},{actor:null,target:null}]){
   await page.route('**/api/follow-timeline?*',r=>r.fulfill({json:{events:[],filters,headCursor:null,nextCursor:null,hasMore:false,updatedAt:data.generatedAt}}));
   await page.route('**/api/follow-timeline/share?*',r=>r.fulfill({json:{...data,filters}}));
   const p=new URLSearchParams();if(filters.actor)p.set('actor',filters.actor.fid);if(filters.target)p.set('target',filters.target.fid);
   await page.goto(base+'/follow-timeline?'+p);await expect(page.getByTestId('share-farcaster')).toBeEnabled();
   await page.getByRole('button',{name:'Farcaster · 3:2',exact:true}).click();
   const image=page.locator('.chart-image-preview img');await expect.poll(()=>image.evaluate(el=>el.naturalHeight)).toBe(800);
   const imageUrl=new URL(await image.getAttribute('src'),base);assert.equal(imageUrl.searchParams.get('actor'),filters.actor?.fid||null);assert.equal(imageUrl.searchParams.get('target'),filters.target?.fid||null);await page.getByRole('button',{name:'Close preview ×'}).click();
   await page.getByTestId('share-farcaster').click();
   await expect.poll(()=>page.evaluate(()=>window.__popups.at(-1)?.location.href)).toContain('text=');
   const compose=new URL(await page.evaluate(()=>window.__popups.at(-1).location.href));
   const text=compose.searchParams.get('text');assert.ok(text.startsWith('Explore the latest'));assert.ok(!text.split('\n\n')[0].includes('@'),'generic share paragraph has no user tags');
   const link=new URL(compose.searchParams.get('embeds[]'));assert.equal(link.searchParams.get('actor'),filters.actor?.fid||null);assert.equal(link.searchParams.get('target'),filters.target?.fid||null);
  }
  await page.route('**/api/follow-timeline/share?*',r=>r.fulfill({status:502,json:{error:'Please retry sharing.'}}));
  fail=true;await page.getByTestId('share-farcaster').click();await expect(page.getByText('Please retry sharing.',{exact:true})).toBeVisible();assert.equal(await page.evaluate(()=>window.__popups.at(-1).closed),true);await expect(page.getByTestId('share-farcaster')).toBeEnabled();
  const host=await browser.newPage({viewport:{width:390,height:850}});
  await host.route('https://faralytics.vercel.app/**',async route=>{const u=new URL(route.request().url());const r=await fetch(base+u.pathname+u.search);await route.fulfill({status:r.status,headers:Object.fromEntries([...r.headers].filter(([k])=>!['content-encoding','content-length','transfer-encoding'].includes(k))),body:Buffer.from(await r.arrayBuffer())});});
  await host.route('**/api/follow-timeline?*',r=>r.fulfill({json:{events:[],filters:data.filters,headCursor:null,nextCursor:null,hasMore:false,updatedAt:data.generatedAt}}));
  await host.route('**/api/follow-timeline/share?*',r=>r.fulfill({json:data}));
  await host.route('**/api/lookup-log',r=>r.fulfill({json:{}}));
  await host.addInitScript(()=>{window.__casts=[];window.ReactNativeWebView={postMessage:raw=>{const req=JSON.parse(raw);let value;if(req.path?.[0]==='context')value={user:{fid:366713},client:{clientFid:9152,added:true,safeAreaInsets:{top:0,bottom:0,left:0,right:0}}};else if(req.path?.[0]==='getCapabilities')value=['actions.composeCast'];else if(req.path?.[0]==='composeCast'){window.__casts.push(req.argumentList[0].value);value={cast:{hash:'0x123',fid:366713}};}setTimeout(()=>document.dispatchEvent(new MessageEvent('FarcasterFrameCallback',{data:{id:req.id,type:'RAW',value}})),20);}};});
  await host.goto('https://faralytics.vercel.app/follow-timeline?target=366713');
  await expect(host.getByTestId('timeline-target-input')).toHaveValue('@nikolaii.eth');
  await host.getByRole('button',{name:'Farcaster · 3:2',exact:true}).click();await expect.poll(()=>host.locator('.chart-image-preview img').evaluate(el=>el.naturalHeight)).toBe(800);await host.getByRole('button',{name:'Close preview ×'}).click();assert.equal(await host.locator('.image-links a[download]').count(),0);
  await host.getByTestId('share-farcaster').click();await expect.poll(()=>host.evaluate(()=>window.__casts.length)).toBe(1);
  const cast=await host.evaluate(()=>window.__casts[0]);assert.ok(cast.text.startsWith('Thanks to my latest followers: '));assert.equal(new URL(cast.embeds[0]).searchParams.get('target'),'366713');assert.ok(cast.text.includes('\n\nCheck Yours\n\n'));for(const event of data.events)if(event.actor.username)assert.ok(cast.text.includes('@'+event.actor.username));
  const other={...data,filters:{actor:null,target:{...data.filters.target,fid:'37',username:'someone'}}};
  await host.route('**/api/follow-timeline?*',r=>r.fulfill({json:{events:[],filters:other.filters,headCursor:null,nextCursor:null,hasMore:false,updatedAt:other.generatedAt}}));
  await host.route('**/api/follow-timeline/share?*',r=>r.fulfill({json:other}));
  await host.goto('https://faralytics.vercel.app/follow-timeline?target=37');await expect(host.getByTestId('timeline-target-input')).toHaveValue('@someone');
  await host.getByTestId('share-farcaster').click();await expect.poll(()=>host.evaluate(()=>window.__casts.length)).toBe(1);
  const otherCast=await host.evaluate(()=>window.__casts[0]);assert.ok(otherCast.text.startsWith('Latest followers of @someone\n\nCheck Yours'));for(const event of data.events)if(event.actor.username)assert.ok(!otherCast.text.split('\n\n')[0].includes('@'+event.actor.username));await host.close();
  console.log('PASS timeline sharing: real 10 distinct follow events, cutoff/validation, all four filter modes plus empty results in both PNG sizes, native composer, crawler metadata, both platform texts, inline FC/X previews on web and host with retry/stable timestamps, timestamped links, copy toast, error recovery and 320–1280 layout. No posts sent.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

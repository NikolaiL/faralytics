const assert=require('node:assert/strict');const{chromium}=require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 const page=await browser.newPage({viewport:{width:375,height:850}});
 await page.goto('http://localhost:3100/');await page.getByTestId('lookup-input').fill('');assert.equal(await page.getByTestId('add-miniapp').count(),0);
 const manifest=await(await page.request.get('http://localhost:3100/.well-known/farcaster.json')).json();assert.equal(manifest.miniapp.webhookUrl,'https://api.neynar.com/f/app/a7310ba9-e0d6-4353-9c29-cae3fa5fa523/event');
 await page.close();const host=await browser.newPage({viewport:{width:375,height:850}});
 await host.route('https://faralytics.vercel.app/**',async route=>{const url=new URL(route.request().url());const response=await fetch('http://localhost:3100'+url.pathname+url.search);await route.fulfill({status:response.status,headers:Object.fromEntries([...response.headers].filter(([key])=>!['content-encoding','content-length','transfer-encoding'].includes(key))),body:Buffer.from(await response.arrayBuffer())});});
 await host.addInitScript(()=>{
  window.__addCalls=0;window.__rejectAdd=true;
  window.ReactNativeWebView={postMessage:raw=>{
   const request=JSON.parse(raw);let value;
   if(request.path?.[0]==='context'){window.__contextSent=true;value={user:{fid:123},client:{clientFid:9152,added:false,safeAreaInsets:{top:0,bottom:0,left:0,right:0}}};}
   else if(request.path?.[0]==='getCapabilities')value=['actions.addMiniApp'];
   else if(request.path?.[0]==='addFrame'){window.__addCalls++;value=window.__rejectAdd?{error:{type:'rejected_by_user'}}:{result:{notificationDetails:{url:'https://example.com/test-notifications',token:'test-token'}}};}
   setTimeout(()=>document.dispatchEvent(new MessageEvent('FarcasterFrameCallback',{data:{id:request.id,type:'RAW',value}})),30);
  }};
 });
 await host.goto('https://faralytics.vercel.app/?user=366713');
 await host.getByTestId('lookup-input').fill('');await host.waitForFunction(()=>window.__contextSent===true);
 await host.getByTestId('add-miniapp').waitFor();assert.equal(await host.evaluate(()=>window.__addCalls),0,'loading an account must not prompt');
 await host.locator('.heatmap rect[role=button]').last().hover();assert.equal(await host.evaluate(()=>window.__addCalls),0,'hover is not a meaningful interaction');
 await host.getByTestId('year-2025').click();await host.getByTestId('add-miniapp-status').filter({hasText:'add it later'}).waitFor();assert.equal(await host.evaluate(()=>window.__addCalls),1);
 const next=host.waitForResponse(r=>r.url().includes('/api/activity?')&&r.status()===200);await host.getByTestId('year-2024').click();await next;assert.equal(await host.evaluate(()=>window.__addCalls),1,'automatic prompt must not repeat after dismissal');
 await host.reload();await host.getByTestId('add-miniapp').waitFor();const afterReload=host.waitForResponse(r=>r.url().includes('/api/activity?')&&r.status()===200);await host.getByTestId('year-2025').click();await afterReload;assert.equal(await host.evaluate(()=>window.__addCalls),0,'reload keeps the declined automatic prompt suppressed');
 await host.evaluate(()=>window.__rejectAdd=false);await host.getByTestId('add-miniapp').dblclick();await host.getByTestId('add-miniapp').waitFor({state:'detached'});assert.equal(await host.evaluate(()=>window.__addCalls),1);assert.equal(await host.getByTestId('add-miniapp-status').count(),0);
 await host.evaluate(()=>document.dispatchEvent(new MessageEvent('FarcasterFrameEvent',{data:{event:'miniapp_removed'}})));await host.getByTestId('add-miniapp').filter({hasText:'Add miniapp'}).waitFor();assert.ok(await host.getByTestId('add-miniapp').isEnabled());
 assert.equal(await host.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await browser.close();console.log('PASS: manifest webhook, FC-only visibility, no prompt on load/hover, first meaningful interaction prompt, persistent dismissal, manual retry, duplicate guard and removal event. No real subscription or notification sent.');
})().catch(error=>{console.error(error);process.exit(1)});

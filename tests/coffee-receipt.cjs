const assert=require('node:assert/strict');const{chromium}=require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 const page=await browser.newPage({viewport:{width:375,height:850}});
 await page.addInitScript(()=>{
  window.__sendCalls=0;
  window.ReactNativeWebView={postMessage:raw=>{
   const request=JSON.parse(raw);let value;
   if(request.path?.[0]==='context')value={user:{fid:366713},client:{clientFid:9152,added:false,safeAreaInsets:{top:0,bottom:0,left:0,right:0}}};
   else if(request.path?.[0]==='getCapabilities')value=['actions.sendToken','actions.addMiniApp'];
   else if(request.path?.[0]==='sendToken'){window.__sendCalls++;window.__sendOptions=request.argumentList[0].value;value={success:true,send:{transaction:'0xc5851a974eb3b2fe31537cf31f811b7e546eb60d7d0be194ac5377421ffa2e7e'}};}
   setTimeout(()=>document.dispatchEvent(new MessageEvent('FarcasterFrameCallback',{data:{id:request.id,type:'RAW',value}})),20);
  }};
 });
 await page.goto((process.env.APP_URL||'https://faralytics.vercel.app')+'/?user=366713');
 await page.getByTestId('buy-coffee').click();
 await page.getByText('Farcaster’s send-money screen will open',{exact:false}).waitFor();
 const start=Date.now();await page.getByTestId('confirm-payment').click();
 await page.getByTestId('payment-status').filter({hasText:'Your send was completed with different details'}).waitFor({timeout:15000});
 assert.equal(await page.evaluate(()=>window.__sendCalls),1);
 assert.equal(await page.getByTestId('transaction-confetti').count(),1);
 assert.equal(await page.getByTestId('transaction-confetti').locator('i').count(),72);
 assert.ok(Date.now()-start<15000);
 assert.ok(await page.getByRole('button',{name:'Close',exact:true}).isEnabled());
 await page.getByTestId('transaction-confetti').waitFor({state:'detached'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.getByTestId('buy-coffee').click();await page.getByText('Farcaster’s send-money screen will open',{exact:false}).waitFor();await page.getByTestId('confirm-payment').click();await page.getByTestId('payment-status').filter({hasText:'Your send was completed with different details'}).waitFor();assert.equal(await page.getByTestId('transaction-confetti').count(),0);
 console.log('PASS: native coffee receipt replay, confirmed-payment confetti, cleanup, reduced-motion suppression and enabled Close. Existing receipt replay only; no payment sent.');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});

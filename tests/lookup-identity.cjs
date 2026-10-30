const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  try {
    const page = await browser.newPage();
    const requests = [];
    let verified = 0;
    await page.route('https://faralytics.vercel.app/**', async route => {
      const url = new URL(route.request().url());
      const response = await fetch('http://localhost:3100' + url.pathname + url.search);
      await route.fulfill({ status: response.status, headers: Object.fromEntries([...response.headers].filter(([key]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(key))), body: Buffer.from(await response.arrayBuffer()) });
    });
    await page.route('**/api/followers?*', route => route.fulfill({ json: {
      from:'2023-03-18 01:00:13', until:'2026-10-30 03:00:00', anchor:'2026-10-30', updatedAt:new Date().toISOString(), countsUpdatedAt:null,
      series:[{ profile:{fid:'10956',username:'test',display_name:null,pfp_url:null},followers:100,firstFollow:'2023-03-18 01:00:13',points:[{ts:1679101213,value:1},{ts:1793329200,value:90}] }]
    } }));
    await page.route('https://auth.farcaster.xyz/nonce', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.fulfill({ json:{nonce:'testnonce123'} });
    });
    await page.route('https://auth.farcaster.xyz/verify-siwf', route => {
      verified++;
      const payload=Buffer.from(JSON.stringify({sub:366713,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
      return route.fulfill({json:{token:`e30.${payload}.mock${verified}`}});
    });
    await page.route('**/api/lookup-log', route => {
      requests.push({headers:route.request().headers(),body:route.request().postDataJSON()});
      return route.fulfill({status:requests.length===1?401:200,json:{}});
    });
    await page.addInitScript(() => {
      window.ReactNativeWebView={postMessage:raw=>{
        const req=JSON.parse(raw);let value;let delay=20;
        if(req.path?.[0]==='context'){delay=3000;value={user:{fid:366713},client:{clientFid:9152,added:true,safeAreaInsets:{top:0,bottom:0,left:0,right:0}}};}
        if(req.path?.[0]==='signIn')value={result:{message:'faralytics.vercel.app wants you to sign in with your Ethereum account:\n0x8D6230427a37986D25Fe4D5B3d0aaEF1b924fEd6\n\nFarcaster Auth\n\nURI: https://faralytics.vercel.app\nVersion: 1\nChain ID: 10\nNonce: testnonce123\nIssued At: 2026-10-31T00:00:00.000Z',signature:'0x1234'}};
        setTimeout(()=>document.dispatchEvent(new MessageEvent('FarcasterFrameCallback',{data:{id:req.id,type:'RAW',value}})),delay);
      }};
    });
    await page.goto('https://faralytics.vercel.app/followers?fids=10956');
    await expect(page.locator('.recharts-line-curve')).toHaveCount(1);
    await page.waitForTimeout(2500);
    assert.equal(requests.length,0,'cold host does not log anonymously');
    await expect.poll(()=>requests.length,{timeout:25000}).toBe(2);
    assert.ok(requests.every(request=>request.headers.authorization?.startsWith('Bearer ')),'no anonymous fallback even after 401');
    assert.equal(verified,2,'rejected token replaced');
    assert.equal(requests[0].body.lookupId,requests[1].body.lookupId,'retry keeps one session');
    assert.deepEqual(requests[1].body.fids,['10956']);
    console.log('PASS delayed Farcaster identity: waits for cold host/auth, retries 401 with fresh token and same session, never sends anonymous request.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1)});

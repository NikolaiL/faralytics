const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  try {
    async function setup(fid, width = 390) {
      const page = await browser.newPage({ viewport: { width, height: 850 } });
      const state = { checks: 0, following: false, viewer: String(fid), unauthorized: false };
      await page.route('https://faralytics.vercel.app/**', async route => {
        const url = new URL(route.request().url());
        const response = await fetch('http://localhost:3100' + url.pathname + url.search);
        await route.fulfill({ status: response.status, headers: Object.fromEntries([...response.headers].filter(([key]) => !['content-encoding','content-length','transfer-encoding'].includes(key))), body: Buffer.from(await response.arrayBuffer()) });
      });
      await page.route('**/api/followers?*', route => route.fulfill({ json: {
        from:'2023-03-18 01:00:13', until:'2026-10-30 03:00:00', anchor:'2026-10-30', updatedAt:new Date().toISOString(), countsUpdatedAt:null,
        series:[{profile:{fid:String(fid || 10956),username:'test',display_name:null,pfp_url:null},followers:100,firstFollow:'2023-03-18 01:00:13',points:[{ts:1679101213,value:1},{ts:1793329200,value:90}]}]
      } }));
      await page.route('**/api/lookup-log', route => route.fulfill({ json: {} }));
      await page.route('https://auth.farcaster.xyz/nonce', route => route.fulfill({ json: { nonce:'testnonce123' } }));
      await page.route('https://auth.farcaster.xyz/verify-siwf', route => {
        const payload = Buffer.from(JSON.stringify({sub:fid,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
        return route.fulfill({json:{token:`e30.${payload}.mock`}});
      });
      await page.route('**/api/follow-status', async route => {
        state.checks++;
        assert.equal(route.request().method(), 'POST');
        assert.ok(route.request().headers().authorization?.startsWith('Bearer '));
        if (state.unauthorized) { state.unauthorized=false; return route.fulfill({status:401,json:{}}); }
        await new Promise(resolve => setTimeout(resolve, 100));
        return route.fulfill({json:{following:state.following,viewerFid:state.viewer,targetFid:'366713'}});
      });
      if (fid) await page.addInitScript(({ fid }) => {
        window.__profileCalls=0; window.__addCalls=0;
        window.ReactNativeWebView={postMessage:raw=>{
          const req=JSON.parse(raw);let value;
          if(req.path?.[0]==='context') value={user:{fid},client:{clientFid:9152,added:false,safeAreaInsets:{top:0,bottom:22,left:0,right:0}}};
          else if(req.path?.[0]==='getCapabilities') value=['actions.addMiniApp','actions.viewProfile'];
          else if(req.path?.[0]==='viewProfile') { window.__profileCalls++; }
          else if(req.path?.[0]==='addFrame') { window.__addCalls++; value={error:{type:'rejected_by_user'}}; }
          else if(req.path?.[0]==='signIn') value={result:{message:'faralytics.vercel.app wants you to sign in with your Ethereum account:\n0x8D6230427a37986D25Fe4D5B3d0aaEF1b924fEd6\n\nFarcaster Auth\n\nURI: https://faralytics.vercel.app\nVersion: 1\nChain ID: 10\nNonce: testnonce123\nIssued At: 2026-10-31T00:00:00.000Z',signature:'0x1234'}};
          setTimeout(()=>document.dispatchEvent(new MessageEvent('FarcasterFrameCallback',{data:{id:req.id,type:'RAW',value}})),20);
        }};
      }, { fid });
      await page.goto('https://faralytics.vercel.app/followers?fids=10956');
      await expect(page.locator('.recharts-line-curve')).toHaveCount(1);
      if (fid) await page.getByTestId('add-miniapp').waitFor();
      return { page, state };
    }

    const {page, state} = await setup(10956);
    const gate=page.getByTestId('follow-gate');
    await expect(gate).not.toBeVisible();
    assert.equal(state.checks,0,'no check on initial load');
    await page.getByTestId('follower-toggle-10956').click();
    await expect(gate).toBeVisible();
    await expect(page.getByTestId('follow-gate-status')).toContainText('Not following yet');
    assert.equal(await page.evaluate(()=>window.__addCalls),0,'add prompt deferred');
    await page.keyboard.press('Escape');
    await expect(gate).toBeVisible();
    assert.equal(await gate.evaluate(el=>el.matches(':modal')),true,'native modal blocks background');
    await page.getByTestId('tab-activity').evaluate(el=>el.focus());
    assert.equal(await page.evaluate(()=>document.activeElement.closest('dialog')!==null),true,'focus stays in dialog');
    await page.mouse.click(1,1);
    await expect(gate).toBeVisible();
    for (const width of [320,390,1280]) {
      await page.setViewportSize({width,height:850});
      const bounds=await gate.boundingBox();
      assert.ok(bounds && bounds.x>=0 && bounds.x+bounds.width<=width && bounds.y>=0 && bounds.y+bounds.height<=850);
    }
    await page.setViewportSize({width:390,height:850});
    await page.screenshot({path:'artifacts/follow-gate-mobile.png'});
    await page.getByTestId('follow-creator').click();
    assert.equal(await page.evaluate(()=>window.__profileCalls),1);
    await expect(gate).toBeVisible();
    await page.getByTestId('follow-recheck').click();
    await expect(page.getByTestId('follow-gate-status')).toContainText('Not following yet');
    state.following=null;
    await page.getByTestId('follow-recheck').click();
    await expect(page.getByTestId('follow-gate-status')).toContainText('couldn’t verify');
    state.following=true; state.viewer='37';
    await page.getByTestId('follow-recheck').click();
    await expect(page.getByTestId('follow-gate-status')).toContainText('couldn’t verify');
    state.viewer='10956'; state.unauthorized=true;
    const before=state.checks;
    await page.getByTestId('follow-creator').click();
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect(gate).not.toBeVisible();
    assert.equal(state.checks,before+2,'401 refreshes token and retries');
    await page.getByTestId('tab-activity').click();
    await expect(gate).not.toBeVisible();
    await page.getByTestId('tab-followers').click();
    await expect(gate).not.toBeVisible();
    await page.route('**/api/follow-timeline?*',r=>r.fulfill({json:{events:[],filters:{actor:null,target:null},headCursor:null,nextCursor:null,hasMore:false,updatedAt:new Date().toISOString()}}));
    await page.getByTestId('tab-follow-timeline').click();await expect(page.getByTestId('timeline-feed')).toBeVisible();await expect(gate).not.toBeVisible();
    assert.equal(state.checks,before+2,'verification survives tab changes');
    await page.close();

    const following=await setup(37);
    following.state.following=true;
    await following.page.getByTestId('followers-reset').click();
    await expect.poll(()=>following.state.checks).toBe(1);
    await expect(following.page.getByTestId('follow-gate')).not.toBeVisible();
    await following.page.getByTestId('show-me').click();
    await expect.poll(()=>following.page.evaluate(()=>window.__addCalls)).toBe(1);
    await following.page.close();

    for (const fid of [null,366713]) {
      const exempt=await setup(fid);
      await exempt.page.getByTestId('followers-reset').click();
      await expect(exempt.page.getByTestId('follow-gate')).toHaveCount(0);
      assert.equal(exempt.state.checks,0,'browser and creator exempt');
      await exempt.page.close();
    }
    console.log('PASS follow gate: first interaction only, FC-only, creator exemption, blocking responsive dialog, negative/unknown/identity mismatch stay locked, profile opens without unlocking, focus recheck, auth retry, existing follower, tab persistence and deferred add prompt. No real follow sent.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1)});

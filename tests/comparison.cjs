const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, expect } = require('@playwright/test');
function fixture(fid, period, anchor) {
 const start = period === '365' ? new Date(new Date(anchor+'T00:00:00Z').getTime()-364*86400000).toISOString().slice(0,10) : period+'-01-01';
 const end = period === '365' ? anchor : period+'-12-31';
 const days=[]; const year=period==='365'?anchor.slice(0,4):period;
 for(let d=new Date(start+'T00:00:00Z');d<=new Date(end+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1)) {
  const date=d.toISOString().slice(0,10), active=fid==='2'?[1,2,3]:[1,3];
  days.push({date,actions:date.startsWith(year+'-01-')&&active.includes(d.getUTCDate())?(fid==='2'?100:10):0,future:date>anchor});
 }
 return {profile:{fid,username:fid==='2'?'v':'nikolaii.eth',display_name:fid==='2'?'V':'Nikolai',pfp_url:null},period,anchor,start,end,days,years:fid==='2'?[2026,2021]:[2026,2025,2024],total:fid==='2'?300:20,activeDays:fid==='2'?3:2,longestStreak:fid==='2'?3:1,peak:fid==='2'?100:10,peakDate:year+'-01-01',updatedAt:new Date().toISOString(),catchingUp:false,coverage:'Historical coverage is incomplete.'};
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 try {
 const context=await browser.newContext({viewport:{width:1280,height:1100},permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();await page.route('**/api/lookup-log',route=>route.fulfill({json:{}}));const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.open=url=>{window.__share=url;return null;};});
 await page.route('**/api/activity?*',async route=>{
  const p=new URL(route.request().url()).searchParams;const fid=p.get('user')==='v'?'2':p.get('user');
  if(fid==='bad'){await route.fulfill({status:404,json:{error:'Account not found.'}});return;}
  if(fid==='99'){await new Promise(r=>setTimeout(r,500));}
  await route.fulfill({json:fixture(fid,p.get('period')||'365',p.get('end')||'2026-10-29')}).catch(()=>{});
 });
 await page.route('**/api/search?*',route=>route.fulfill({json:[{fid:'2',username:'v',display_name:'V',pfp_url:null,followerCount:50000}]}));
 await page.goto('http://localhost:3100/');
 assert.equal(await page.getByText('No sign-in. Just curiosity.',{exact:true}).count(),0);
 assert.equal(await page.getByTestId('compare-toggle').count(),0);
 await page.getByTestId('lookup-input').fill('366713');await page.getByTestId('lookup-submit').click();
 await expect(page.getByTestId('year-2021')).toHaveCount(0);
 await page.getByTestId('compare-toggle').click();await expect(page.getByTestId('compare-input')).toBeVisible();
 await expect(page.getByTestId('compare-submit')).toBeDisabled();
 await page.getByTestId('compare-input').fill('v');await page.getByTestId('compare-result').first().waitFor();
 await page.getByTestId('compare-input').press('ArrowDown');
 assert.equal(await page.getByTestId('compare-input').getAttribute('aria-activedescendant'),'compare-result-0');
 await page.getByTestId('compare-input').press('Enter');await page.getByTestId('comparison-chart').waitFor();
 assert.equal(new URL(page.url()).searchParams.get('compare'),'2');
 assert.ok(await page.getByTestId('comparison-stat-peak').evaluate(el=>{const label=el.querySelector('[data-testid="comparison-peak-label"]'),values=[...el.querySelectorAll('.overall-stat-value')];return values.length===2&&label.textContent==='Actions on busiest day'&&values.every(value=>value.getBoundingClientRect().bottom<=label.getBoundingClientRect().top);}), 'busiest-day label is below both account values');
 for(const year of [2026,2025,2024,2023,2022,2021]) await expect(page.getByTestId(`year-${year}`)).toBeVisible();
 await expect(page.getByTestId('compare-clear')).toBeVisible();
 assert.equal(await page.getByTestId('comparison-grid-1').locator('rect[aria-label$="10 captured actions"]').first().getAttribute('fill'),'#855dcd');
 assert.equal(await page.getByTestId('comparison-grid-2').locator('rect[aria-label$="100 captured actions"]').first().getAttribute('fill'),'#8bbdff');
 assert.equal(await page.getByTestId('comparison-stat-activeDays').locator('.account-2 .winner').count(),1);
 assert.equal(await page.getByTestId('comparison-stat-peak').locator('.account-1 .winner').count(),0);
 await page.getByTestId('year-2024').click();await expect(page.getByTestId('year-2024')).toHaveAttribute('aria-pressed','true');
 await page.waitForFunction(()=>!document.querySelector('.is-loading'));
 for(const n of [1,2]) assert.equal(await page.getByTestId(`comparison-grid-${n}`).locator('rect').count(),366);
 await page.getByTestId('copy-link').click();const link=new URL(await page.evaluate(()=>navigator.clipboard.readText()));
 assert.equal(link.pathname,'/share/366713');assert.equal(link.searchParams.get('compare'),'2');assert.equal(link.searchParams.get('period'),'2024');assert.match(link.searchParams.get('ts'),/^\d{13}$/);
 for(const id of ['share-x','share-farcaster-bottom']) {await page.getByTestId(id).click();const share=new URL(await page.evaluate(()=>window.__share));assert.match(share.searchParams.get('text'),/@nikolaii.eth vs @v: 20 vs 300/);const embedded=new URL(share.searchParams.get('url')||share.searchParams.get('embeds[]'));assert.equal(embedded.searchParams.get('compare'),'2');}
 for(const w of [320,360,375,390,768,1280]) {await page.setViewportSize({width:w,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`No page overflow at ${w}`);}
 await page.setViewportSize({width:390,height:1000});await page.screenshot({path:'artifacts/comparison-mobile.png',fullPage:true});
 await page.setViewportSize({width:1280,height:1100});await page.screenshot({path:'artifacts/comparison-desktop.png',fullPage:true});
 await page.reload();await page.getByTestId('comparison-chart').waitFor();assert.equal(await page.getByTestId('compare-name-2').innerText(),'@v');
 await page.getByTestId('compare-clear').click();await expect(page.getByTestId('year-2021')).toHaveCount(0);assert.equal(await page.getByTestId('comparison-chart').count(),0);assert.equal(new URL(page.url()).searchParams.has('compare'),false);
 await page.getByTestId('compare-input').fill('366713');await page.getByTestId('compare-submit').click();await expect(page.getByTestId('compare-error')).toContainText('different account');
 await page.getByTestId('compare-input').fill('bad');await page.getByTestId('compare-submit').click();await expect(page.getByTestId('compare-error')).toContainText('not found');assert.equal(await page.getByTestId('activity-total').innerText(),'20');
 await page.getByTestId('compare-input').fill('99');await page.getByTestId('compare-submit').click();await page.getByTestId('compare-toggle').click();await page.waitForTimeout(700);assert.equal(await page.getByTestId('comparison-chart').count(),0);assert.equal(await page.getByTestId('compare-search').count(),0);
 await page.getByTestId('lookup-clear').click();assert.equal(await page.getByTestId('compare-toggle').count(),0);assert.deepEqual(errors,[]);
 // The share page and image endpoints use actual server data, independent of browser API fixtures.
 const sharePath='/share/366713?compare=2&period=2024&end=2026-10-29&ts=1793250000123';
 const shareResponse=await page.goto('http://localhost:3100'+sharePath,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(shareResponse.status(),200);await page.getByTestId('comparison-chart').waitFor();
 for(const selector of ['meta[property="og:image"]','meta[name="twitter:image"]']) {const image=new URL(await page.locator(selector).getAttribute('content'));assert.equal(image.searchParams.get('compare'),'2');assert.equal(image.searchParams.get('ts'),'1793250000123');}
 const embed=JSON.parse(await page.locator('meta[name="fc:miniapp"]').getAttribute('content'));assert.equal(new URL(embed.button.action.url).searchParams.get('compare'),'2');
 const sharp=require(process.cwd()+'/packages/nextjs/node_modules/sharp');
 for(const [format,height] of [['farcaster',800],['x',600]]) {const r=await page.request.get(`http://localhost:3100/api/og/${format}.png?fid=366713&compare=2&period=2024&end=2026-10-29`);assert.equal(r.status(),200,await r.text().catch(()=>''));const bytes=await r.body();assert.equal((await sharp(bytes).metadata()).height,height);fs.writeFileSync(`artifacts/comparison-${format}.png`,bytes);}
 for(const compare of ['bad','366713','0']) {const r=await page.request.get('http://localhost:3100/api/og/x.png?fid=366713&compare='+compare);assert.equal(r.status(),400);}
 assert.equal((await page.request.get('http://localhost:3100/share/366713?compare=bad')).status(),404);
 console.log('PASS comparison: dropdown + keyboard, shared scale, winners, years, sharing/reload/reset, errors/cancellation, mobile widths, real HTML/OG metadata and both PNG sizes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

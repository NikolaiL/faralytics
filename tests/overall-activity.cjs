const assert=require('node:assert/strict');const fs=require('node:fs');const{chromium,expect}=require('@playwright/test');const sharp=require('../packages/nextjs/node_modules/sharp');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});try{
 const page=await browser.newPage({viewport:{width:390,height:900}});await page.route('**/api/lookup-log',r=>r.fulfill({json:{}}));
 const today=await(await page.request.get('http://localhost:3100/api/activity?user=366713')).json();
 const historical=await(await page.request.get('http://localhost:3100/api/activity?user=366713&period=2024')).json();
 assert.ok(today.overall?.firstDate);assert.deepEqual(historical.overall,today.overall,'overall stats independent of selected year');assert.ok(today.overall.activeDays>=today.activeDays);assert.ok(today.overall.longestStreak>=today.longestStreak);assert.ok(today.overall.longestStreakStart&&today.overall.longestStreakEnd);
 fs.mkdirSync('artifacts/overall-activity',{recursive:true});
 for(const compare of [false,true]){
  await page.goto('http://localhost:3100/?user=366713&period=2024'+(compare?'&compare=10956':''),{waitUntil:'domcontentloaded'});
  const section=page.getByTestId('overall-activity');await expect(section).toBeVisible();await expect(section).toContainText('First activity reported on');await expect(section).toContainText('days ago.');await expect(section.locator('.overall-stats>div')).toHaveCount(3);await expect(section.locator('.overall-stat-value')).toHaveCount(compare?6:3);await expect(page.getByTestId('overall-longestStreak').locator('.overall-stat-date').first()).toContainText(' – ');
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page fits '+width);await page.screenshot({path:`artifacts/overall-activity/${compare?'comparison':'individual'}-${width}.png`,fullPage:true});}
  for(const [format,height]of[['farcaster',800],['x',600]]){const response=await page.request.get(`http://localhost:3100/api/og/${format}.png?fid=366713&period=2024${compare?'&compare=10956':''}`);assert.equal(response.status(),200,await response.text().then(x=>x.slice(0,120)));const bytes=await response.body();const meta=await sharp(bytes).metadata();assert.deepEqual([meta.width,meta.height],[1200,height]);fs.writeFileSync(`artifacts/overall-activity/${compare?'comparison':'individual'}-${format}.png`,bytes);}
 }
 const nft=await page.request.post('http://localhost:3100/api/nft/prepare',{data:{user:'366713',period:'365',end:'2026-10-30'}});assert.equal(nft.status(),200);assert.ok(Buffer.from((await nft.json()).imageBase64,'base64').length<=262144);
 console.log('PASS overall activity: all-history stats across selected years, streak intervals, individual/comparison, 320/390/1280 layouts, four OG sizes and NFT preview limit. No mint/upload.');
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exit(1)});

const assert=require('node:assert/strict');const fs=require('node:fs');const{chromium,expect}=require('@playwright/test');const sharp=require('../packages/nextjs/node_modules/sharp');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});try{
 const page=await browser.newPage({viewport:{width:390,height:900}});await page.route('**/api/lookup-log',r=>r.fulfill({json:{}}));
 for(const path of ['/?user=366713','/?user=366713&compare=10956','/followers?fids=366713,10956']){
  await page.goto('http://localhost:3100'+path);await page.locator('.numeric-value').first().waitFor();await page.evaluate(()=>document.fonts.ready);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
  assert.ok(await page.locator('.numeric-value').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).fontWeight==='900')));
  if(path.startsWith('/followers')){await page.locator('.recharts-cartesian-axis-tick-value').first().waitFor();assert.ok(await page.locator('.recharts-cartesian-axis-tick-value').evaluateAll(nodes=>nodes.every(n=>Number(getComputedStyle(n).fontWeight)<700)),'axes remain regular');}
  else{assert.equal(await page.getByTestId('activity-total').evaluate(n=>getComputedStyle(n).fontWeight),'900');assert.ok(await page.locator('.stats strong').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).fontWeight==='900')));}
 }
 fs.mkdirSync('artifacts/numeric-weight',{recursive:true});
 for(const [name,base]of[['activity','/api/og/FORMAT.png?fid=366713'],['comparison','/api/og/FORMAT.png?fid=366713&compare=10956'],['followers','/api/og/followers/FORMAT.png?fids=366713,10956,3,4,37,38'],['default','/api/og/FORMAT.png']]){
  for(const[format,height]of[['farcaster',800],['x',600]]){const response=await page.request.get('http://localhost:3100'+base.replace('FORMAT',format));assert.equal(response.status(),200,name+' '+format);const bytes=await response.body();const meta=await sharp(bytes).metadata();assert.deepEqual([meta.width,meta.height],[1200,height]);fs.writeFileSync(`artifacts/numeric-weight/${name}-${format}.png`,bytes);}
 }
 const nft=await page.request.post('http://localhost:3100/api/nft/prepare',{data:{user:'366713',period:'365',end:'2026-10-30'}});assert.equal(nft.status(),200,'NFT artwork preparation');const image=Buffer.from((await nft.json()).imageBase64,'base64');assert.ok(image.length<=262144);fs.writeFileSync('artifacts/numeric-weight/nft.png',image);
 for(const route of ['og/[format]','og/followers/[format]','nft/prepare']){const trace=JSON.parse(fs.readFileSync(`packages/nextjs/.next/server/app/api/${route}/route.js.nft.json`));assert.ok(trace.files.some(f=>f.endsWith('FaralyticsSans-Black.ttf')),'font included in '+route);}
 console.log('PASS Black numeric weight, regular axes, 320–1280 layouts, eight OG formats, NFT preview size and deployed font tracing. No mint or upload performed.');
}finally{await browser.close();}})().catch(error=>{console.error(error.message);process.exit(1)});

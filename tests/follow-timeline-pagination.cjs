const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const base = process.env.BASE_URL || 'http://localhost:3100';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 850 } });
      const profile = { fid:'366713', username:'alice', display_name:null, pfp_url:null };
      const events = Array.from({length:200}, (_,i) => ({
        id:'0x'+(200-i).toString(16).padStart(40,'0'), cursor:String(200-i),
        timestamp:new Date(Date.now()-i*1000).toISOString(), action:i%2?'unfollow':'follow',
        actor:profile, target:{...profile,fid:'37',username:'bob'},
      }));
      let olderRequests = 0;
      await page.route('**/api/lookup-log', route => route.fulfill({json:{}}));
      await page.route('**/api/follow-timeline?*', async route => {
        const params = new URL(route.request().url()).searchParams;
        const offset = params.has('before') ? events.findIndex(e=>e.cursor===params.get('before'))+1 : 0;
        if (params.has('before')) { olderRequests++; await new Promise(resolve=>setTimeout(resolve,250)); }
        const rows = params.has('after') ? [] : events.slice(offset,offset+20);
        await route.fulfill({json:{events:rows,filters:{actor:null,target:null},headCursor:rows[0]?.cursor||null,nextCursor:rows.at(-1)?.cursor||null,hasMore:offset+20<events.length,updatedAt:new Date().toISOString()}});
      });
      await page.goto(base + '/follow-timeline');
      await expect(page.getByTestId('timeline-event')).toHaveCount(20);
      await page.getByTestId('timeline-pause').click();
      for (let batch=1; batch<=2; batch++) {
        const lastVisible = page.getByTestId('timeline-event').nth(batch*20-1);
        await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
        await expect.poll(()=>olderRequests).toBe(batch);
        const before = await lastVisible.boundingBox();
        const scrollY = await page.evaluate(()=>window.scrollY);
        await expect(page.getByTestId('timeline-event')).toHaveCount((batch+1)*20);
        await page.waitForTimeout(800);
        assert.equal(olderRequests,batch,`one older page per scroll at ${width}px`);
        const after = await lastVisible.boundingBox();
        assert.ok(Math.abs(after.y-before.y)<2,`last visible row stays in place at ${width}px: ${before.y} -> ${after.y}`);
        assert.ok(Math.abs(await page.evaluate(()=>window.scrollY)-scrollY)<2,'document scroll position retained');
      }
      await page.close();
    }
    console.log('PASS timeline pagination: desktop/mobile retain the visible row and scroll position, load one page per reach, and require scrolling farther for the next page.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1)});

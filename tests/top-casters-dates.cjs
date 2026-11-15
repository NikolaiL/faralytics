const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { chromium, expect } = require('@playwright/test');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3100';
const day = date => date.toISOString().slice(0, 10);
const today = day(new Date());
const shift = (date, days) => day(new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000));
function embed(html) {
  const content = html.match(/<meta name="fc:miniapp" content="([^"]+)"/)[1];
  return JSON.parse(content.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&#x27;', "'"));
}
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const legacy = '/top-casters?period=all&end=2026-11-13&user=366713&metric=likes_received&ts=1794547262340';
    const initial = page.waitForResponse(r => r.url().includes('/api/top-casters?') && new URL(r.url()).searchParams.get('end') === today);
    await page.goto(origin + legacy, { waitUntil: 'networkidle', timeout: 60000 });
    assert.equal((await initial).status(), 200);
    assert.equal(new URL(page.url()).searchParams.has('end'), false);
    await expect(page.locator('.caster-card')).toHaveCount(9);
    const initialEmbed = JSON.parse(await page.locator('meta[name="fc:miniapp"]').getAttribute('content'));
    assert.equal(new URL(initialEmbed.imageUrl).searchParams.get('end'), today);
    assert.equal(new URL(initialEmbed.button.action.url).searchParams.has('end'), false);
    let todayData;
    for (const period of ['today', 'yesterday', 'days7', 'days30', 'days365', 'all']) {
      const loaded = page.waitForResponse(r => r.url().includes('/api/top-casters?') && new URL(r.url()).searchParams.get('period') === period);
      await page.getByLabel('Caster timeframe').selectOption(period);
      const response = await loaded;
      assert.equal(response.status(), 200);
      assert.equal(new URL(response.url()).searchParams.get('end'), today);
      const data = await response.json();
      assert.equal(data.through, period === 'yesterday' ? shift(today, -1) : today);
      if (period === 'today') todayData = data;
      assert.equal(new URL(page.url()).searchParams.has('end'), false);
      const card = page.locator('.caster-card').filter({ has: page.locator('#caster-likes_received') });
      await card.getByRole('button', { name: 'Copy link', exact: true }).click();
      const share = new URL(await page.evaluate(() => navigator.clipboard.readText()));
      assert.equal(share.searchParams.has('end'), false);
      assert.equal(share.searchParams.get('period'), period);
      assert.equal(share.searchParams.get('user'), '366713');
      assert.equal(share.searchParams.get('metric'), 'likes_received');
      assert.match(share.searchParams.get('ts'), /^\d{13}$/);
      const sharedPage = await page.request.get(origin + share.pathname + share.search);
      assert.equal(sharedPage.status(), 200);
      const sharedEmbed = embed(await sharedPage.text());
      const image = new URL(sharedEmbed.imageUrl);
      assert.equal(image.searchParams.get('end'), today);
      assert.equal(image.searchParams.get('period'), period);
      assert.equal(image.searchParams.get('ts'), share.searchParams.get('ts'));
      assert.equal(new URL(sharedEmbed.button.action.url).searchParams.has('end'), false);
      if (period === 'today') {
        const png = await page.request.get(origin + image.pathname + image.search, { timeout: 60000 });
        assert.equal(png.status(), 200);
        assert.match(png.headers()['cache-control'], /max-age=300/);
        const bytes = await png.body();
        assert.equal(bytes.readUInt32BE(16), 1200); assert.equal(bytes.readUInt32BE(20), 800);
        mkdirSync('artifacts', { recursive: true });
        writeFileSync('artifacts/top-casters-dynamic-today.png', bytes);
      }
    }
    // Internal endpoints retain explicit dates for immutable image/NFT snapshots.
    const archived = await page.request.get(origin + '/api/top-casters?period=today&end=2026-11-13&user=366713');
    assert.equal((await archived.json()).through, '2026-11-13');
    const rollover = await context.newPage();
    rollover.on('pageerror', error => errors.push(error.message));
    await rollover.clock.install({ time: new Date(today + 'T12:00:00Z') });
    await rollover.clock.pauseAt(new Date(today + 'T23:59:59Z'));
    const requests = [];
    await rollover.route('**/api/top-casters?*', route => {
      const end = new URL(route.request().url()).searchParams.get('end');
      requests.push(end);
      return route.fulfill({ json: { ...todayData, start: end, through: end } });
    });
    const first = rollover.waitForResponse(r => r.url().includes('/api/top-casters?'));
    await rollover.goto(origin + '/top-casters?period=today&user=366713', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await first;
    assert.deepEqual(requests, [today]);
    const midnight = rollover.waitForResponse(r => new URL(r.url()).searchParams.get('end') === shift(today, 1));
    await rollover.clock.runFor(1100);
    await midnight;
    await expect(rollover.locator('.caster-card')).toHaveCount(9);
    await rollover.clock.setSystemTime(new Date(shift(today, 2) + 'T08:00:00Z'));
    const resumed = rollover.waitForResponse(r => new URL(r.url()).searchParams.get('end') === shift(today, 2));
    await rollover.evaluate(() => window.dispatchEvent(new Event('focus')));
    await resumed;
    await rollover.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
    assert.deepEqual(requests, [today, shift(today, 1), shift(today, 2)]);
    assert.equal(new URL(rollover.url()).searchParams.has('end'), false);
    assert.deepEqual(errors, []);
    console.log('PASS dynamic Top Casters dates: legacy end ignored/removed, six live windows, date-free share URLs, UTC-keyed image metadata/cache, midnight and multi-day resume refresh, fixed internal snapshot dates. No posts or transactions sent.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

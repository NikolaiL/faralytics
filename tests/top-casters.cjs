const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium, expect } = require('@playwright/test');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3100';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { window.open = url => { window.__lastShare = url; return null; }; });
    await page.goto(origin + '/top-casters', { waitUntil: 'networkidle' });
    await expect(page.locator('.caster-card')).toHaveCount(9);
    await expect(page.getByTestId('tab-top-casters')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Caster timeframe')).toHaveValue('days7');
    assert.equal(await page.locator('.caster-card .interaction-ranking li').count(), 90);
    for (const period of ['today', 'yesterday', 'days30', 'days365', 'all', 'days7']) {
      const response = page.waitForResponse(r => r.url().includes('/api/top-casters?') && new URL(r.url()).searchParams.get('period') === period);
      await page.getByLabel('Caster timeframe').selectOption(period);
      const loaded = await response;
      assert.equal(loaded.status(), 200);
      const data = await loaded.json();
      await expect(page.locator('.caster-card')).toHaveCount(9);
      assert.equal(await page.locator('.caster-card .interaction-ranking li').count(), data.lists.reduce((sum, list) => sum + list.rows.length, 0));
    }
    // Reuse exact username/FID lookup and keep the selected UTC window.
    await page.getByTestId('caster-account-input').fill('!');
    await page.getByTestId('caster-account-submit').click();
    await expect(page.locator('.top-casters-page [role=alert]')).toContainText('valid');
    let selected = page.waitForResponse(r => r.url().includes('/api/top-casters?') && new URL(r.url()).searchParams.get('user') === '366713');
    await page.getByTestId('caster-account-input').fill('@nikolaii.eth');
    await page.getByTestId('caster-account-submit').click();
    assert.equal((await selected).status(), 200);
    await expect(page.getByTestId('caster-account-input')).toHaveValue('@nikolaii.eth');
    assert.equal(new URL(page.url()).searchParams.get('period'), 'days7');
    assert.equal(new URL(page.url()).searchParams.get('user'), '366713');
    let cleared = page.waitForResponse(r => r.url().includes('/api/top-casters?') && !new URL(r.url()).searchParams.has('user'));
    await page.getByTestId('caster-account-clear').click();
    assert.equal((await cleared).status(), 200);
    await expect(page.getByTestId('caster-account-input')).toHaveValue('');
    assert.equal(new URL(page.url()).searchParams.has('user'), false);
    selected = page.waitForResponse(r => r.url().includes('/api/top-casters?') && new URL(r.url()).searchParams.get('user') === '3');
    await page.getByTestId('caster-account-input').fill('3');
    await page.getByTestId('caster-account-submit').click();
    assert.equal((await selected).status(), 200);
    await expect(page.getByTestId('caster-account-clear')).toBeVisible();
    const card = page.locator('.caster-card').filter({ has: page.getByRole('heading', { name: 'Most mentioned', exact: true }) });
    await card.getByRole('button', { name: 'Copy link', exact: true }).click();
    const share = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    assert.equal(share.pathname, '/top-casters');
    assert.equal(share.searchParams.get('metric'), 'mentions_received');
    assert.equal(share.searchParams.get('period'), 'days7');
    assert.match(share.searchParams.get('end'), /^\d{4}-\d{2}-\d{2}$/);
    assert.match(share.searchParams.get('ts'), /^\d{13}$/);
    for (const target of ['X', 'Farcaster']) {
      await card.getByRole('button', { name: 'Share on ' + target, exact: true }).click();
      const compose = new URL(await page.evaluate(() => window.__lastShare));
      const linked = new URL(compose.searchParams.get(target === 'X' ? 'url' : 'embeds[]'));
      assert.equal(linked.searchParams.get('metric'), 'mentions_received');
      assert.match(compose.searchParams.get('text'), /Most mentioned/);
    }
    const sharedPath = share.pathname + share.search;
    const html = await (await page.request.get(origin + sharedPath)).text();
    assert.ok(html.includes('caster-mentions_received'));
    assert.ok(html.includes('fc:miniapp'));
    assert.ok(html.includes('/api/og/top-casters/farcaster.png?'));
    assert.ok(html.includes('/api/og/top-casters/x.png?'));
    assert.ok(!html.includes('caster-casts"'));
    await page.goto(origin + sharedPath, { waitUntil: 'networkidle' });
    await expect(page.locator('.caster-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Show all categories' }).click();
    await expect(page.locator('.caster-card')).toHaveCount(9);
    mkdirSync('artifacts', { recursive: true });
    for (const width of [1280, 820, 761, 760, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
      const nav = await page.getByTestId('tab-top-casters').boundingBox();
      assert.ok(nav.x >= 0 && nav.x + nav.width <= width, `navigation at ${width}`);
      if (width === 390 || width === 1280) await page.screenshot({ path: `artifacts/top-casters-${width}.png`, fullPage: true });
    }
    // A failed period request must surface an error and a working retry, with no stale rows.
    await page.route('**/api/top-casters?*', route => route.fulfill({ status: 502, json: { error: 'Fixture unavailable' } }));
    await page.getByLabel('Caster timeframe').selectOption('today');
    await expect(page.locator('.top-casters-page [role=alert]')).toContainText('Fixture unavailable');
    await expect(page.locator('.caster-card')).toHaveCount(0);
    await page.unroute('**/api/top-casters?*');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('.caster-card')).toHaveCount(9);
    const embed = JSON.parse(await page.locator('meta[name="fc:miniapp"]').getAttribute('content'));
    assert.equal(new URL(embed.imageUrl).pathname, '/api/og/top-casters/farcaster.png');
    for (const [format, height] of [['farcaster', 800], ['x', 600]]) {
      const image = await page.request.get(`${origin}/api/og/top-casters/${format}.png?${share.searchParams}`, { timeout: 60000 });
      assert.equal(image.status(), 200);
      const png = await image.body();
      assert.equal(png.readUInt32BE(16), 1200);
      assert.equal(png.readUInt32BE(20), height);
      require('node:fs').writeFileSync(`artifacts/top-casters-${format}.png`, png);
    }
    // Simulate a native viewer and verify that the signed-in identity changes the lists and sharing.
    const host = await context.newPage();
    host.on('pageerror', error => errors.push(error.message));
    let nativeShare;
    await host.route('https://faralytics.vercel.app/**', async route => {
      const url = new URL(route.request().url());
      const response = await fetch(origin + url.pathname + url.search);
      await route.fulfill({ status: response.status, headers: Object.fromEntries([...response.headers].filter(([key]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(key))), body: Buffer.from(await response.arrayBuffer()) });
    });
    await host.exposeFunction('recordShare', value => { nativeShare = value; });
    await host.addInitScript(() => {
      window.ReactNativeWebView = { postMessage: raw => {
        const request = JSON.parse(raw); let value;
        if (request.path?.[0] === 'context') value = { user: { fid: 366713 }, client: { clientFid: 9152, added: true, safeAreaInsets: { top: 0, bottom: 22, left: 0, right: 0 } } };
        else if (request.path?.[0] === 'getCapabilities') value = ['actions.composeCast'];
        else if (request.path?.[0] === 'composeCast') { window.recordShare(request.argumentList[0].value); value = { cast: null }; }
        setTimeout(() => document.dispatchEvent(new MessageEvent('FarcasterFrameCallback', { data: { id: request.id, type: 'RAW', value } })), 20);
      } };
    });
    const personalized = host.waitForResponse(r => r.url().includes('/api/top-casters?') && new URL(r.url()).searchParams.get('user') === '366713');
    await host.goto('https://faralytics.vercel.app/top-casters?period=days365', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const response = await personalized; assert.equal(response.status(), 200);
    const data = await response.json();
    await expect(host.locator('.caster-card')).toHaveCount(9);
    for (const list of data.lists) {
      const section = host.locator('.caster-card').filter({ has: host.locator(`#caster-${list.metric}`) });
      assert.deepEqual(await section.locator('li').evaluateAll(rows => rows.map(row => Number(row.value))), list.rows.map(row => row.position));
      if (list.userPosition !== null) await expect(section.locator('.caster-self')).toHaveCount(1);
    }
    await host.locator('.caster-card').first().getByRole('button', { name: 'Share on Farcaster', exact: true }).click();
    await expect.poll(() => nativeShare).toBeTruthy();
    assert.ok(JSON.stringify(nativeShare).includes('user=366713'));
    assert.ok(nativeShare.text.startsWith('Top Casters · Most original casts · 365 days\n\nI am ranked #'));
    assert.ok(nativeShare.text.includes(`I am ranked #${data.lists[0].userPosition.toLocaleString('en-US')}. How about you?`));
    const nativeLink = new URL(nativeShare.embeds[0]);
    assert.equal(nativeLink.searchParams.get('metric'), 'casts');
    assert.equal(nativeLink.searchParams.get('period'), 'days365');
    await page.goto(origin + nativeLink.pathname + nativeLink.search, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.caster-card')).toHaveCount(1);
    await expect(page.locator('#caster-casts')).toBeVisible();
    await expect(page.getByLabel('Caster timeframe')).toHaveValue('days365');
    // A manual subject overrides host identity, and Me restores it after reset.
    const otherResponse = host.waitForResponse(r => r.url().includes('/api/top-casters?') && new URL(r.url()).searchParams.get('user') === '3');
    await host.getByTestId('caster-account-input').fill('3');
    await host.getByTestId('caster-account-submit').click();
    assert.equal((await otherResponse).status(), 200);
    await expect(host.getByTestId('caster-account-clear')).toBeVisible();
    await expect(host.locator('.caster-self small').first()).toHaveText('Selected account');
    nativeShare = undefined;
    await host.locator('.caster-card').first().getByRole('button', { name: 'Share on Farcaster', exact: true }).click();
    await expect.poll(() => nativeShare).toBeTruthy();
    assert.ok(!nativeShare.text.includes('I am'));
    assert.equal(new URL(nativeShare.embeds[0]).searchParams.get('user'), '3');
    const globalResponse = host.waitForResponse(r => r.url().includes('/api/top-casters?') && !new URL(r.url()).searchParams.has('user'));
    await host.getByTestId('caster-account-clear').click();
    assert.equal((await globalResponse).status(), 200);
    const meResponse = host.waitForResponse(r => r.url().includes('/api/top-casters?') && new URL(r.url()).searchParams.get('user') === '366713');
    await host.getByTestId('show-me').click();
    assert.equal((await meResponse).status(), 200);
    await expect(host.locator('.caster-self small').first()).toHaveText('You');
    await host.route('**/api/top-casters?*', route => route.fulfill({ json: {
      ...data, profiles: [{ fid: '366713', username: 'unranked-caster.eth', display_name: null }],
      lists: data.lists.map(list => ({ ...list, userPosition: null, rows: Array.from({ length: 10 }, (_, i) => ({ fid: String(i + 1), position: i + 1, score: 100 - i })) })),
    } }));
    await host.getByLabel('Caster timeframe').selectOption('today');
    await expect(host.locator('.caster-card .timeline-note')).toHaveCount(9);
    await expect(host.locator('.caster-card .timeline-note').first()).toHaveText('@unranked-caster.eth is unranked: no captured activity in this category for the selected period.');
    await expect(host.locator('.caster-card').first().locator('li')).toHaveCount(10);
    await expect(host.locator('.caster-card').first().locator('.captured-badge')).toHaveText('Top 10 · unranked');
    assert.deepEqual(errors, []);
    console.log('PASS Top Casters browser: six timeframes, nine lists, list sharing/HTML metadata, native viewer/composer, username/FID search, reset/Me, retry, responsive layout and 1200×800/600 PNGs. No social post sent.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3100';
const start = Date.parse('2026-11-17T12:00:00Z');
const profile = { fid: '366713', username: 'test-caster', display_name: null };
const counts = { casts: 1, replies: 2, recasts: 3, likes: 4, mentions: 5, dau: 1 };
const cursor = id => `${start / 1000}:0x${id.toString(16).padStart(40, '0')}`;
const snapshot = (id, hasMore = false) => ({
  events: [{ id: String(id), cursor: cursor(id), timestamp: new Date(start).toISOString(), action: 'like', actor: profile, target: profile, text: '', castHash: '0x' + 'a'.repeat(40), mentions: [], mentionCount: 0 }],
  headCursor: cursor(id), hasMore, profile, date: '2026-11-17', now: new Date(start).toISOString(),
  totals: { today: counts, yesterday: counts, asOf: new Date(start).toISOString() },
  source: { checkedAt: null, catchingUp: false, coverage: 'Captured history is incomplete.' },
});
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: start });
    await page.clock.pauseAt(start);
    await page.addInitScript(() => {
      window.__testHidden = false;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__testHidden });
    });
    let next = 1, hasMore = false, fail = false, holdNext = false, release;
    await page.route('**/api/live-view?*', async route => {
      const body = snapshot(next, hasMore);
      requests.push(new URL(route.request().url()));
      if (holdNext) {
        holdNext = false;
        await new Promise(resolve => { release = resolve; });
      }
      await route.fulfill(fail ? { status: 502, json: { error: 'Refresh failed' } } : { json: body });
    });
    const visibility = hidden => page.evaluate(hidden => {
      window.__testHidden = hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
    let time = start;
    const advance = async ms => { time += ms; await page.clock.setSystemTime(time); };
    const rows = () => page.locator('.live-events li');
    const waitForCalls = count => expect.poll(() => requests.length).toBe(count);
    const requestAt = index => requests[index].searchParams;
    await page.goto(origin + '/live-view?user=366713&type=like');
    await expect(rows()).toHaveAttribute('data-event-id', '1');
    assert.equal(requestAt(0).has('after'), false);

    // Exactly three minutes still uses the cursor and preserves a reader's pending rows.
    await rows().locator('a').first().focus();
    next = 2;
    await visibility(true); await advance(180000); await visibility(false);
    await expect(page.getByRole('button', { name: 'Show new events ↑' })).toBeVisible();
    assert.equal(requestAt(1).get('after'), cursor(1));
    await expect(rows()).toHaveAttribute('data-event-id', '1');

    // Older than three minutes replaces the view, including queued events, in one read.
    next = 3; hasMore = true;
    await visibility(true); await advance(180001); await visibility(false);
    await expect(rows()).toHaveAttribute('data-event-id', '3');
    assert.equal(requestAt(2).has('after'), false);
    await expect(page.getByRole('button', { name: 'Show new events ↑' })).toHaveCount(0);
    await page.clock.runFor(400); time += 400;
    assert.equal(requests.length, 3, 'fresh snapshots must not start a backlog drain');

    // A short absence continues from the new cursor.
    next = 4; hasMore = false;
    await visibility(true); await advance(60000); await visibility(false);
    await expect(rows()).toHaveCount(2);
    assert.equal(requestAt(3).get('after'), cursor(3));

    // Paused tabs stay paused; Resume after an hour jumps straight to the latest events.
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    next = 5;
    await visibility(true); await advance(3600000); await visibility(false);
    assert.equal(requests.length, 4);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(rows()).toHaveCount(1);
    await expect(rows()).toHaveAttribute('data-event-id', '5');
    assert.equal(requestAt(4).has('after'), false);

    // Failed fresh reads retain the last successful view and retry without an old cursor.
    fail = true;
    await advance(180001); await visibility(false);
    await expect(page.locator('.live-view-page [role=alert]')).toContainText('Refresh failed');
    await expect(rows()).toHaveAttribute('data-event-id', '5');
    assert.equal(requestAt(5).has('after'), false);
    fail = false; next = 6;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(rows()).toHaveAttribute('data-event-id', '6');
    assert.equal(requestAt(6).has('after'), false);

    // A suspended in-flight response must not make an hour-old batch appear freshly updated.
    holdNext = true; next = 7;
    await visibility(false); await waitForCalls(8);
    assert.equal(requestAt(7).get('after'), cursor(6));
    await visibility(true); await advance(3600000); await visibility(false);
    next = 8;
    const delayed = page.waitForResponse(response => response.url().includes('/api/live-view?'));
    release(); await delayed;
    await page.clock.runFor(1);
    await waitForCalls(9);
    await expect(rows()).toHaveAttribute('data-event-id', '8');
    assert.equal(requestAt(8).has('after'), false);
    for (const request of requests) {
      assert.equal(request.searchParams.get('user'), '366713');
      assert.equal(request.searchParams.get('type'), 'like');
    }
    assert.deepEqual(errors, []);
    console.log('PASS Live View resume: three-minute boundary, fresh replacement and pending reset, short-gap cursor continuity, paused hour-long absence, retry, delayed in-flight response and preserved filters.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

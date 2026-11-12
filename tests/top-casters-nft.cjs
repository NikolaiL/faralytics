const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { chromium, expect } = require('@playwright/test');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3100';
const fork = process.env.FORK_TEST === '1';
let sequence = 0;
async function rpc(method, params = []) {
  const response = await fetch('http://127.0.0.1:8547', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method, params }),
  });
  const body = await response.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}
(async () => {
  const { validatePackage } = await import('../packages/nextjs/lib/ipfs.ts');
  const browser = await chromium.launch();
  const errors = [];
  let writes = 0, pins = 0, reject = false, minted;
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  try {
    if (fork) {
      assert.equal(new URL(origin).hostname, 'localhost');
      assert.match(await rpc('web3_clientVersion'), /Hardhat/);
      assert.equal(await rpc('eth_chainId'), '0x2105');
      await rpc('evm_setIntervalMining', [1000]);
      await rpc('evm_mine');
      const [account] = await rpc('eth_accounts');
      const NFT = JSON.parse(readFileSync('packages/hardhat/deployments/base/FaralyticsIPFS.json')).address;
      const { Interface } = createRequire(resolve('packages/hardhat/package.json'))('ethers');
      const abi = new Interface(['function nextTokenId() view returns(uint256)', 'function tokenURI(uint256) view returns(string)', 'function ownerOf(uint256) view returns(address)']);
      assert.notEqual(await rpc('eth_getCode', [NFT, 'latest']), '0x');
      const token = BigInt(await rpc('eth_call', [{ to: NFT, data: abi.encodeFunctionData('nextTokenId') }, 'latest']));
      await page.exposeFunction('walletRpc', async ({ method, params }) => {
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [account];
        if (method === 'wallet_switchEthereumChain') return null;
        if (method === 'eth_sendTransaction') {
          writes++;
          if (reject) { reject = false; throw new Error('User rejected the request'); }
          assert.equal(params[0].to.toLowerCase(), NFT.toLowerCase());
          assert.equal(BigInt(params[0].value), 1000000000000000n);
        }
        const value = await rpc(method, params);
        if (method === 'eth_sendTransaction') await rpc('evm_mine');
        return value;
      });
      await page.addInitScript(() => {
        window.ethereum = { isMetaMask: true, on() {}, removeListener() {}, request: async args => {
          try { return await window.walletRpc(args); }
          catch (error) { if (/User rejected/.test(error.message)) error.code = 4001; throw error; }
        } };
      });
      await page.route('https://base-rpc.publicnode.com/**', async route => {
        const response = await fetch('http://127.0.0.1:8547', { method: 'POST', headers: { 'content-type': 'application/json' }, body: route.request().postData() });
        await route.fulfill({ status: 200, contentType: 'application/json', body: await response.text() });
      });
      await page.route('**/api/nft/publish', async route => {
        pins++;
        const body = route.request().postDataJSON();
        const uri = abi.decodeFunctionResult('tokenURI', await rpc('eth_call', [{ to: NFT, data: abi.encodeFunctionData('tokenURI', [token]) }, 'latest']))[0];
        assert.equal(uri, body.metadataURI);
        assert.equal(abi.decodeFunctionResult('ownerOf', await rpc('eth_call', [{ to: NFT, data: abi.encodeFunctionData('ownerOf', [token]) }, 'latest']))[0].toLowerCase(), account.toLowerCase());
        await route.fulfill({ status: pins === 1 ? 502 : 200, json: pins === 1 ? { error: 'Upload fixture failure' } : { metadataURI: uri } });
      });
      minted = () => token;
    }
    await page.goto(origin + '/top-casters?period=days7', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('mint-nft')).toHaveCount(9);
    await expect(page.getByTestId('buy-coffee')).toHaveCount(0);
    assert.equal(await page.locator('.caster-mint').first().evaluate(node => node.previousElementSibling.classList.contains('share-actions-below')), true);
    const card = page.locator('.caster-card').filter({ has: page.locator('#caster-likes_received') });
    const preparedResponse = page.waitForResponse(r => r.url().includes('/api/nft/prepare') && r.request().method() === 'POST');
    await card.getByTestId('mint-nft').click();
    const response = await preparedResponse;
    assert.equal(response.status(), 200);
    const prepared = await response.json();
    await validatePackage(prepared);
    assert.match(prepared.signature, /^[a-f0-9]{64}$/);
    const image = Buffer.from(prepared.imageBase64, 'base64');
    assert.equal(image.readUInt32BE(16), 1200); assert.equal(image.readUInt32BE(20), 800);
    const metadata = JSON.parse(prepared.metadataJSON);
    assert.match(metadata.name, /Top Casters · Most liked · 7 days/);
    assert.equal(metadata.properties.topCasters.lists.length, 1);
    assert.equal(metadata.properties.topCasters.lists[0].metric, 'likes_received');
    assert.equal(metadata.properties.topCasters.lists[0].rows.length, 10);
    assert.equal(new URL(metadata.external_url).searchParams.get('metric'), 'likes_received');
    assert.equal(metadata.properties.topCasters.selection.user, undefined);
    await expect(page.locator('.nft-preview')).toBeVisible();
    assert.equal(writes, 0); assert.equal(pins, 0);
    mkdirSync('artifacts', { recursive: true });
    writeFileSync('artifacts/top-casters-nft-preview.png', image);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const personal = page.waitForResponse(r => r.url().includes('/api/top-casters?') && new URL(r.url()).searchParams.get('user') === '366713');
    await page.getByTestId('caster-account-input').fill('366713');
    await page.getByTestId('caster-account-submit').click();
    assert.equal((await personal).status(), 200);
    const changed = page.waitForResponse(r => r.url().includes('/api/top-casters?') && new URL(r.url()).searchParams.get('period') === 'all');
    await page.getByLabel('Caster timeframe').selectOption('all'); assert.equal((await changed).status(), 200);
    const personalPrepared = page.waitForResponse(r => r.url().includes('/api/nft/prepare'));
    await card.getByTestId('mint-nft').click();
    const personalResponse = await personalPrepared; assert.equal(personalResponse.status(), 200);
    const personalPackage = await personalResponse.json(); await validatePackage(personalPackage);
    const personalMetadata = JSON.parse(personalPackage.metadataJSON);
    const snapshot = personalMetadata.properties.topCasters;
    assert.equal(snapshot.selection.user, '366713'); assert.equal(snapshot.selection.period, 'all');
    assert.equal(snapshot.lists[0].metric, 'likes_received');
    assert.ok(snapshot.lists[0].rows.some(row => row.fid === '366713' && row.position === snapshot.lists[0].userPosition));
    assert.equal(new URL(personalMetadata.external_url).searchParams.get('user'), '366713');
    assert.equal(new URL(personalMetadata.external_url).searchParams.get('end'), snapshot.selection.end);
    await expect(page.locator('.nft-preview')).toBeVisible();
    assert.equal(writes, 0); assert.equal(pins, 0);
    for (const patch of [{ metric: 'invalid' }, { metric: '' }, { period: '' }, { period: [] }, { user: 366713 }, { user: '' }, { user: '18446744073709551616' }, { end: '2099-01-01' }]) {
      const bad = await page.request.post(origin + '/api/nft/prepare', { data: { kind: 'top-casters', period: 'days7', end: snapshot.selection.end, metric: 'casts', ...patch } });
      assert.equal(bad.status(), 400, JSON.stringify(patch));
    }
    const unpaid = await page.request.post(origin + '/api/nft/publish', { data: { ...personalPackage, tokenId: '999999999' } });
    assert.equal(unpaid.status(), 409);
    const tampered = await page.request.post(origin + '/api/nft/publish', { data: { ...personalPackage, metadataJSON: personalPackage.metadataJSON + ' ', tokenId: '1' } });
    assert.equal(tampered.status(), 400);
    if (fork) {
      await page.getByTestId('confirm-payment').click(); await page.getByTestId('connect-injected').click();
      await expect(page.getByTestId('confirm-payment')).toContainText('Confirm mint');
      reject = true; await page.getByTestId('confirm-payment').click();
      await expect.poll(() => writes, { timeout: 30000 }).toBe(1);
      await expect(page.getByTestId('payment-status')).toContainText('Cancelled');
      await page.getByTestId('confirm-payment').dblclick();
      await expect(page.getByTestId('payment-status')).toContainText('Your mint transaction is saved', { timeout: 60000 });
      assert.equal(writes, 2, 'one rejection and exactly one submitted fork mint'); assert.equal(pins, 1);
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('.caster-card').first().getByTestId('mint-nft').click();
      await expect(page.getByRole('heading', { name: 'Finish NFT upload', exact: true })).toBeVisible();
      await page.getByTestId('retry-nft-upload').click();
      await expect(page.getByTestId('payment-status')).toContainText('pinned on IPFS', { timeout: 60000 });
      assert.equal(writes, 2); assert.equal(pins, 2);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('faralytics:pending-ipfs-nft')), null);
      console.log(`PASS Base-fork token ${minted()}: wallet rejection, one paid mint, exact URI/owner, double-click guard, upload failure and cross-category recovery after reload without another payment. Upload responses simulated.`);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
    } else await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.goto(origin + '/?user=366713', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByTestId('mint-nft')).toHaveCount(1, { timeout: 60000 });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByTestId('mint-nft').click(); await expect(page.locator('.nft-preview')).toBeVisible({ timeout: 60000 });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(errors, []);
    console.log('PASS Top Casters NFT: nine buttons below shares, exact global/personalized category packages, 1200×800 PNG and CIDs, validation, unpaid/tampered rejection, responsive layout and existing activity preview.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

const assert=require('node:assert/strict');const{chromium}=require('@playwright/test');
const origin=process.env.APP_URL||'http://localhost:3100';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 const page=await browser.newPage({viewport:{width:375,height:850}});
 await page.goto(origin+'/?user=366713');await page.getByTestId('buy-coffee').click();await page.getByTestId('confirm-payment').click();
 await page.getByTestId('connect-coinbaseWalletSDK').waitFor();assert.equal(await page.getByTestId('connect-injected').count(),0);assert.match(await page.getByTestId('wallet-options').innerText(),/No browser wallet extension detected/);
 const popupPromise=page.waitForEvent('popup',{timeout:15000});
 await page.getByTestId('connect-coinbaseWalletSDK').click();
 const popup=await popupPromise;await popup.waitForURL(url=>/coinbase\.com$/.test(url.hostname),{timeout:15000});
 assert.ok(/coinbase\.com$/.test(new URL(popup.url()).hostname));await popup.close();
 console.log('No-extension browser: picker and Coinbase connection UI open.');
 await page.close();
 const context=await browser.newContext({viewport:{width:375,height:850}});const injected=await context.newPage();
 await injected.addInitScript(()=>{
  window.__requests=0;window.__reject=true;
  window.ethereum={isMetaMask:true,on(){},removeListener(){},request:async({method})=>{
   if(method==='eth_chainId')return '0x2105';
   if(method==='wallet_switchEthereumChain')return null;
   if(method==='eth_accounts')return [];
   if(method==='eth_requestAccounts'){window.__requests++;if(window.__reject){const e=new Error('User rejected connection');e.code=4001;throw e;}return ['0x0000000000000000000000000000000000001234'];}
   throw new Error('Unexpected wallet method '+method);
  }};
 });
 await injected.goto(origin+'/?user=366713');await injected.getByTestId('buy-coffee').click();await injected.getByTestId('confirm-payment').click();await injected.getByTestId('connect-injected').click();await injected.getByTestId('payment-status').filter({hasText:'Connection cancelled'}).waitFor();
 await injected.evaluate(()=>window.__reject=false);await injected.getByTestId('connect-injected').dblclick();await injected.getByTestId('payment-status').filter({hasText:'Wallet connected'}).waitFor();assert.equal(await injected.evaluate(()=>window.__requests),2);assert.equal(await injected.getByTestId('wallet-options').count(),0);assert.match(await injected.getByTestId('confirm-payment').innerText(),/Confirm coffee/);assert.equal(await injected.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await browser.close();console.log('PASS: browser wallet picker, no-extension Coinbase UI, installed wallet, rejection/retry and duplicate guard. No payment sent.');
})().catch(error=>{console.error(error);process.exit(1)});

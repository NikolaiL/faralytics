const fs = require('node:fs');
const path = require('node:path');
const { Wallet } = require('ethers');

const walletPath = path.resolve(__dirname, '../.deploy-wallet.json');

async function saveWallet(wallet, password, destination = walletPath) {
  const encrypted = await wallet.encrypt(password);
  fs.writeFileSync(destination, encrypted, { flag: 'wx', mode: 0o600 });
}

async function main() {
  if (fs.existsSync(walletPath)) {
    console.log('A deployer wallet is already imported. Existing wallet was preserved.');
    return;
  }
  if (!process.stdin.isTTY) throw new Error('Run yarn account:import in an interactive terminal.');
  const { default: password } = await import('@inquirer/password');
  let wallet;
  while (!wallet) {
    const key = await password({ message: 'Paste your deployer private key:', mask: '*' });
    try { wallet = new Wallet(key.trim()); }
    catch { console.log('Invalid private key. Please try again.'); }
  }
  let pass;
  while (true) {
    pass = await password({ message: 'Choose a password to encrypt your wallet:', mask: '*' });
    if (!pass) { console.log('A non-empty password is required.'); continue; }
    const confirmation = await password({ message: 'Confirm password:', mask: '*' });
    if (pass === confirmation) break;
    console.log('Passwords do not match. Please try again.');
  }
  await saveWallet(wallet, pass);
  console.log(`Imported deployer: ${wallet.address}`);
  console.log(`Encrypted wallet saved to ${walletPath}`);
  console.log('Remember your password. Importing does not send a transaction.');
}

module.exports = { saveWallet, walletPath };
if (require.main === module) main().catch(error => {
  console.error(error.name === 'ExitPromptError' ? 'Wallet import cancelled.' : 'Wallet import failed. Check your terminal and wallet-file permissions.');
  process.exitCode = 1;
});

const fs=require('node:fs');
const path=require('node:path');
const {JsonRpcProvider,AbiCoder}=require('ethers');
const deployment=JSON.parse(fs.readFileSync('deployments/base/FaralyticsIPFS.json','utf8'));
const ADDRESS=deployment.address;
const TX=deployment.transactionHash;
async function main(){
 const provider=new JsonRpcProvider('https://base-rpc.publicnode.com');
 const transaction=await provider.getTransaction(TX);
 const args=AbiCoder.defaultAbiCoder().encode(['address'],['0x8D6230427a37986D25Fe4D5B3d0aaEF1b924fEd6']).slice(2);
 let build;
 for(const name of fs.readdirSync('artifacts/build-info')){
  const candidate=JSON.parse(fs.readFileSync(path.join('artifacts/build-info',name),'utf8'));
  const code=candidate.output.contracts['contracts/FaralyticsIPFS.sol']?.FaralyticsIPFS?.evm.bytecode.object;
  if(code&&transaction.data.toLowerCase().endsWith((code+args).toLowerCase())){build=candidate;break;}
 }
 if(!build)throw new Error('No build matches the deployed creation bytecode.');
 fs.writeFileSync('verification/FaralyticsIPFS.standard-input.json',JSON.stringify(build.input,null,2));
 const compiler='v'+build.solcLongVersion.split('.Emscripten')[0];
 console.log('Exact deployed creation bytecode matched. Compiler:',compiler);
 const configPath='/Users/nikolailebedovsky/va/vb/.env';
 const text=fs.existsSync(configPath)?fs.readFileSync(configPath,'utf8'):'';
 const entry=text.match(/^\s*ETHERSCAN_API_KEY\s*=\s*([^\r\n]*)/m);
 const apiKey=process.env.ETHERSCAN_API_KEY||entry?.[1].trim().replace(/^['"]|['"]$/g,'');
 if(!apiKey)throw new Error('Etherscan verification key is unavailable.');
 const body=new URLSearchParams({apikey:apiKey,chainid:'8453',module:'contract',action:'verifysourcecode',contractaddress:ADDRESS,sourceCode:JSON.stringify(build.input),codeformat:'solidity-standard-json-input',contractname:'contracts/FaralyticsIPFS.sol:FaralyticsIPFS',compilerversion:compiler,optimizationUsed:'1',runs:'200',constructorArguements:args,constructorArguments:args,evmVersion:'paris',licenseType:'3'});
 const result=process.argv.includes('--status')
  ? JSON.parse(fs.readFileSync('verification/BaseScan-IPFS-submission.json','utf8')).response
  : await (await fetch('https://api.etherscan.io/v2/api?'+new URLSearchParams({apikey:apiKey,chainid:'8453'}),{method:'POST',body,signal:AbortSignal.timeout(30000)})).json();
 console.log('BaseScan verification submission:',JSON.stringify(result));
 if(result.status!=='1'&&!/already verified/i.test(result.result||''))throw new Error('Verification submission rejected.');
 fs.writeFileSync('verification/BaseScan-IPFS-submission.json',JSON.stringify({address:ADDRESS,compiler,response:result},null,2));
 if(result.status==='1'){
  const status=await(await fetch('https://api.etherscan.io/v2/api?'+new URLSearchParams({apikey:apiKey,chainid:'8453',module:'contract',action:'checkverifystatus',guid:result.result}),{signal:AbortSignal.timeout(30000)})).json();
  console.log('BaseScan verification status:',JSON.stringify(status));
  fs.writeFileSync('verification/BaseScan-IPFS-status.json',JSON.stringify({address:ADDRESS,...status},null,2));
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1});

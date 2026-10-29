const assert=require('node:assert/strict');
const fs=require('node:fs');
const {ethers,network}=require('hardhat');
const FEE=ethers.parseEther('0.001');
const FACTORY='0x4e59b44847b379578588920cA78FbF26c0B4956C';
const RECIPIENT='0x8d6230427a37986d25fe4d5b3d0aaef1b924fed6';
let nft,owner,buyer,other,snapshot;
before(async()=>{
  assert.equal((await ethers.provider.getNetwork()).chainId,31337n,'write tests must run on a fork');
  [owner,buyer,other]=await ethers.getSigners();
  const now=Math.floor((await ethers.provider.getBlock('latest')).timestamp/86400);
  snapshot={fid:366713n,startDay:now-364,anchorDay:now,year:0,total:365,activeDays:365,longestStreak:365,peak:1,peakDay:now-364,username:'nikolaii.eth',levels:'0x'+'04'.repeat(365)};
  nft=await(await ethers.getContractFactory('FaralyticsNFT')).deploy(owner.address);
  await nft.waitForDeployment();
});
describe('Faralytics NFT on Base fork',function(){
  this.timeout(120000);
  it('requires exact 0.001 ETH and validates snapshots',async()=>{
    for(const value of [0n,FEE-1n,FEE+1n])await assert.rejects(nft.connect(buyer).mint(snapshot,{value}));
    for(const s of [{...snapshot,levels:'0x'},{...snapshot,username:'<script>'},{...snapshot,levels:'0x'+'06'.repeat(365)},{...snapshot,peak:366},{...snapshot,peakDay:snapshot.anchorDay+1},{...snapshot,anchorDay:snapshot.anchorDay+100}])await assert.rejects(nft.connect(buyer).mint(s,{value:FEE}));
  });
  it('mints transferable ERC721s with permanent self-contained metadata',async()=>{
    await(await nft.connect(buyer).mint(snapshot,{value:FEE})).wait();
    assert.equal(await nft.ownerOf(1),buyer.address);
    const uri=await nft.tokenURI(1);
    const metadata=JSON.parse(Buffer.from(uri.split(',')[1],'base64').toString());
    assert.match(metadata.name,/Faralytics #1/);
    assert.match(metadata.image,/^data:image\/svg\+xml;base64,/);
    const svg=Buffer.from(metadata.image.split(',')[1],'base64').toString();
    assert.match(svg,/@nikolaii.eth/);assert.match(svg,/365/);
    assert.equal((svg.match(/width="17" height="17"/g)||[]).length,365);
    fs.mkdirSync('../../artifacts',{recursive:true});fs.writeFileSync('../../artifacts/nft-preview.svg',svg);
    await(await nft.connect(buyer).transferFrom(buyer.address,other.address,1)).wait();
    assert.equal(await nft.tokenURI(1),uri);
    await assert.rejects(nft.tokenURI(999));
    console.log('tokenURI gas:',(await nft.tokenURI.estimateGas(1)).toString());
  });
  it('releases all mint fees only to the immutable recipient',async()=>{
    assert.equal(await nft.owner(),owner.address);
    await assert.rejects(nft.connect(other).withdrawFees());
    const before=await ethers.provider.getBalance(owner.address);
    const receipt=await(await nft.connect(owner).withdrawFees()).wait();
    assert.equal(await ethers.provider.getBalance(owner.address)-before+receipt.fee,FEE);
    assert.equal(await ethers.provider.getBalance(await nft.getAddress()),0n);
    await(await nft.connect(owner).withdrawFees()).wait();
  });
  it('blocks reentrancy through ERC721 receiver callbacks',async()=>{
    const receiver=await(await ethers.getContractFactory('ReentrantReceiver')).deploy(await nft.getAddress());
    await receiver.waitForDeployment();
    await(await receiver.mint(snapshot,{value:FEE})).wait();
    assert.equal(await receiver.blocked(),true);
    assert.equal(await receiver.revertSelector(),ethers.id('ReentrancyGuardReentrantCall()').slice(0,10));
    assert.equal(await nft.ownerOf(2),await receiver.getAddress());
  });
  it('keeps zero-activity and leap-year images valid',async()=>{
    const year={...snapshot,year:2024,startDay:19723,anchorDay:snapshot.anchorDay,total:0,activeDays:0,longestStreak:0,peak:0,peakDay:0,levels:'0x'+'00'.repeat(366)};
    await(await nft.connect(buyer).mint(year,{value:FEE})).wait();
    assert.match(Buffer.from((await nft.tokenURI(3)).split(',')[1],'base64').toString(),/2024/);
  });
  it('deploys reproducibly through the live Base CREATE2 proxy',async()=>{
    const artifact=await ethers.getContractFactory('FaralyticsNFT');
    const init=(await artifact.getDeployTransaction(RECIPIENT)).data;
    const salt=ethers.id('faralytics.activity-nft.v1');
    const predicted=ethers.getCreate2Address(FACTORY,salt,ethers.keccak256(init));
    assert.notEqual(await ethers.provider.getCode(FACTORY),'0x');
    await(await buyer.sendTransaction({to:FACTORY,data:ethers.concat([salt,init])})).wait();
    const deployed=artifact.attach(predicted);
    assert.equal((await deployed.feeRecipient()).toLowerCase(),RECIPIENT);
    assert.equal(await deployed.MINT_PRICE(),FEE);
    assert.equal((await deployed.owner()).toLowerCase(),RECIPIENT);
  });
  it('sends exactly 2 native USDC on Base without any approvals',async()=>{
    const usdc=await ethers.getContractAt(['function decimals() view returns(uint8)','function symbol() view returns(string)','function balanceOf(address) view returns(uint256)','function transfer(address,uint256) returns(bool)'],'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    assert.equal(await usdc.decimals(),6n);assert.equal(await usdc.symbol(),'USDC');
    const whale='0x4d4454cfaaa011cc3a8c3527a4d59430860c70e6';
    assert.ok(await usdc.balanceOf(whale)>=2000000n,'funded Base USDC account');
    assert.ok(whale,'a real USDC-funded account must be available on the fork');
    await network.provider.send('hardhat_impersonateAccount',[whale]);
    await network.provider.send('hardhat_setBalance',[whale,'0x1000000000000000000']);
    const signer=await ethers.getSigner(whale);
    const before=await usdc.balanceOf(RECIPIENT);
    await(await usdc.connect(signer).transfer(RECIPIENT,2000000n)).wait();
    assert.equal(await usdc.balanceOf(RECIPIENT)-before,2000000n);
    await network.provider.send('hardhat_stopImpersonatingAccount',[whale]);
  });
});

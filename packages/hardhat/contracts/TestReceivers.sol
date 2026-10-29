// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {FaralyticsNFT} from "./FaralyticsNFT.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
contract ReentrantReceiver is IERC721Receiver {
    FaralyticsNFT public immutable nft;
    bool public blocked;
    bytes4 public revertSelector;
    constructor(FaralyticsNFT target){nft=target;}
    function mint(FaralyticsNFT.Snapshot calldata s) external payable {nft.mint{value:0.001 ether}(s);}
    function onERC721Received(address,address,uint256 tokenId,bytes calldata) external returns(bytes4){
        (bool ok,bytes memory reason)=address(nft).call(abi.encodeCall(nft.mint,(nft.snapshot(tokenId))));blocked=!ok;
        if(reason.length>=4)revertSelector=bytes4(reason);
        return IERC721Receiver.onERC721Received.selector;
    }
}

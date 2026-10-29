// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Immutable IPFS metadata links for user-submitted Farcaster artwork.
contract FaralyticsIPFS is ERC721, Ownable2Step, ReentrancyGuard {
    uint256 public constant MINT_PRICE = 0.001 ether;
    address payable public immutable feeRecipient;
    uint256 public nextTokenId = 1;
    mapping(uint256 => string) private uris;
    error WrongFee();
    error InvalidURI();
    error TransferFailed();
    event ActivityMinted(uint256 indexed tokenId, address indexed minter, string metadataURI);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    constructor(address payable recipient) ERC721("Faralytics", "FARA") Ownable(recipient) { feeRecipient = recipient; }
    function mint(string calldata metadataURI) external payable nonReentrant returns(uint256 tokenId) {
        if(msg.value != MINT_PRICE) revert WrongFee();
        bytes memory uri = bytes(metadataURI);
        if(uri.length != 66) revert InvalidURI();
        bytes memory prefix = bytes("ipfs://bafkrei");
        for(uint256 i; i < prefix.length; i++) if(uri[i] != prefix[i]) revert InvalidURI();
        for(uint256 i = prefix.length; i < uri.length; i++) {
            if(!((uri[i] >= 0x61 && uri[i] <= 0x7a) || (uri[i] >= 0x32 && uri[i] <= 0x37))) revert InvalidURI();
        }
        tokenId = nextTokenId++;
        uris[tokenId] = metadataURI;
        _safeMint(msg.sender, tokenId);
        emit ActivityMinted(tokenId, msg.sender, metadataURI);
    }
    function tokenURI(uint256 tokenId) public view override returns(string memory) { _requireOwned(tokenId); return uris[tokenId]; }
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        if(amount == 0) return;
        (bool ok,) = feeRecipient.call{value: amount}("");
        if(!ok) revert TransferFailed();
        emit FeesWithdrawn(feeRecipient, amount);
    }
}

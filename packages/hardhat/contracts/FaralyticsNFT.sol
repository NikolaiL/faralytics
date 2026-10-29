// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Permanent user-submitted Farcaster chart snapshots, not proof of FID ownership.
contract FaralyticsNFT is ERC721, Ownable2Step, ReentrancyGuard {
    using Strings for uint256;
    uint256 public constant MINT_PRICE = 0.001 ether;
    address payable public immutable feeRecipient;
    uint256 public nextTokenId = 1;

    struct Snapshot {
        uint64 fid;
        uint32 startDay;
        uint32 anchorDay;
        uint16 year; // Zero means a rolling 365-day chart.
        uint64 total;
        uint16 activeDays;
        uint16 longestStreak;
        uint32 peak;
        uint32 peakDay; // Zero if there are no actions.
        string username;
        bytes levels; // 0..4 activity colors, 5 means a future day.
    }
    mapping(uint256 => Snapshot) private snapshots;
    mapping(uint256 => uint256) public capturedAt;
    error WrongFee();
    error InvalidSnapshot();
    error TransferFailed();
    event ActivityMinted(uint256 indexed tokenId, address indexed minter, uint64 indexed fid, uint16 year);
    event FeesWithdrawn(address indexed recipient, uint256 amount);

    constructor(address payable recipient) ERC721("Faralytics", "FARA") Ownable(recipient) {
        if (recipient == address(0)) revert InvalidSnapshot();
        feeRecipient = recipient;
    }

    function mint(Snapshot calldata s) external payable nonReentrant returns (uint256 tokenId) {
        if (msg.value != MINT_PRICE) revert WrongFee();
        _validate(s);
        tokenId = nextTokenId++;
        snapshots[tokenId] = s;
        capturedAt[tokenId] = block.timestamp;
        _safeMint(msg.sender, tokenId);
        emit ActivityMinted(tokenId, msg.sender, s.fid, s.year);
    }

    /// @notice The owner can release accrued fees; the destination can never be changed.
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        if (amount == 0) return;
        (bool ok,) = feeRecipient.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit FeesWithdrawn(feeRecipient, amount);
    }

    function snapshot(uint256 tokenId) external view returns (Snapshot memory) {
        _requireOwned(tokenId);
        return snapshots[tokenId];
    }

    function preview(Snapshot calldata s) external view returns (string memory) {
        _validate(s);
        return string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(_image(s))));
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Snapshot memory s = snapshots[tokenId];
        string memory period = s.year == 0 ? "the past 365 days" : uint256(s.year).toString();
        string memory image = string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(_image(s))));
        return string.concat("data:application/json;base64,", Base64.encode(bytes(string.concat(
            '{"name":"Faralytics #', tokenId.toString(), '","description":"Permanent snapshot of captured Farcaster activity in ', period,
            '. User-submitted artwork; not proof of FID ownership or complete protocol history.","image":"', image,
            '","attributes":[{"trait_type":"FID","value":"',uint256(s.fid).toString(),
            '"},{"trait_type":"Period","value":"',period,'"},{"trait_type":"Actions","value":"',uint256(s.total).toString(),
            '"},{"trait_type":"Captured at (Unix)","value":"',capturedAt[tokenId].toString(),'"}]}'
        ))));
    }

    function _validate(Snapshot calldata s) private view {
        uint256 n=s.levels.length;
        if (s.fid==0 || (n!=365 && n!=366) || (s.year==0 && n!=365) || bytes(s.username).length==0 || bytes(s.username).length>63 || s.startDay<18628 || s.anchorDay>block.timestamp/1 days || s.startDay>s.anchorDay || s.activeDays>n || s.longestStreak>s.activeDays || s.peak>s.total) revert InvalidSnapshot();
        if (s.year!=0 && (s.year<2021 || s.year>2100)) revert InvalidSnapshot();
        if (s.peak>0 && (s.peakDay<s.startDay || s.peakDay>=s.startDay+n || s.peakDay>s.anchorDay)) revert InvalidSnapshot();
        if (s.peak==0 && (s.total!=0 || s.activeDays!=0 || s.longestStreak!=0 || s.peakDay!=0)) revert InvalidSnapshot();
        bytes memory name=bytes(s.username);
        for(uint256 i=0;i<name.length;i++) {
            bytes1 c=name[i];
            if(!((c>=0x61&&c<=0x7a)||(c>=0x30&&c<=0x39)||c==0x2e||c==0x2d))revert InvalidSnapshot();
        }
        for(uint256 i=0;i<n;i++) {
            uint8 level=uint8(s.levels[i]);
            if(level>5 || (s.startDay+i>s.anchorDay ? level!=5 : level==5))revert InvalidSnapshot();
        }
    }

    function _color(uint8 level) private pure returns(string memory) {
        if(level==0)return "#211b2e";
        if(level==1)return "#3f2a61";
        if(level==2)return "#624090";
        if(level==3)return "#855dcd";
        if(level==4)return "#b596f2";
        return "#14111c";
    }

    function _join(string[] memory parts) private pure returns(string memory) {
        uint256 size;
        for(uint256 i=0;i<parts.length;i++)size+=bytes(parts[i]).length;
        bytes memory output=new bytes(size+32);
        uint256 cursor;
        for(uint256 i=0;i<parts.length;i++) {
            bytes memory part=bytes(parts[i]);
            assembly ("memory-safe") {
                let length:=mload(part)
                let destination:=add(add(output,32),cursor)
                let source:=add(part,32)
                for {let offset:=0} lt(offset,length) {offset:=add(offset,32)} {mstore(add(destination,offset),mload(add(source,offset)))}
            }
            cursor+=part.length;
        }
        assembly ("memory-safe") {mstore(output,size)}
        return string(output);
    }

    function _date(uint256 day) private pure returns(string memory) {
        if(day==0)return "None";
        uint256 year=2021;
        uint256 remaining=day-18628;
        while(true){uint256 daysInYear=_leap(year)?366:365;if(remaining<daysInYear)break;remaining-=daysInYear;year++;}
        uint256[12] memory monthDays=[uint256(31),28,31,30,31,30,31,31,30,31,30,31];
        if(_leap(year))monthDays[1]=29;
        string[12] memory months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        uint256 month;
        while(remaining>=monthDays[month]){remaining-=monthDays[month];month++;}
        return string.concat(months[month]," ",(remaining+1).toString(),", ",year.toString());
    }
    function _leap(uint256 year) private pure returns(bool){return year%4==0&&(year%100!=0||year%400==0);}

    function _image(Snapshot memory s) private pure returns(string memory) {
        uint256 offset=(uint256(s.startDay)+4)%7;
        uint256 columns=(offset+s.levels.length+6)/7;
        string[] memory cells=new string[](s.levels.length);
        for(uint256 i=0;i<s.levels.length;i++) {
            cells[i]=string.concat('<rect x="',((i+offset)/7*19).toString(),'" y="',((i+offset)%7*19).toString(),'" width="17" height="17" rx="3" fill="',_color(uint8(s.levels[i])),'"/>');
        }
        string memory period=s.year==0?"the past 365 days":uint256(s.year).toString();
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#0d0b12"/><g font-family="sans-serif"><text x="64" y="75" fill="#d6ff3f" font-size="27" font-weight="700">faralytics.</text><text x="1136" y="75" text-anchor="end" fill="#a99aba" font-size="16">FARCASTER, DAY BY DAY</text><text x="64" y="180" fill="#d6ff3f" font-size="40">@',s.username,
            '</text><text x="64" y="270" fill="#f3eff9" font-size="66" font-weight="700">',uint256(s.total).toString(),
            '</text><text x="64" y="311" fill="#a99aba" font-size="22">actions in ',period,'</text><svg x="69" y="350" width="1062" height="', (131*1062/(columns*19-2)).toString(),'" viewBox="0 0 ',(columns*19-2).toString(),' 131">',_join(cells),
            '</svg>',_box(64,uint256(s.activeDays).toString(),"active days"),_box(427,uint256(s.longestStreak).toString(),"day longest streak"),_box(789,uint256(s.peak).toString(),string.concat("actions on ",_date(s.peakDay))),
            '<text x="64" y="735" fill="#857594" font-size="14">FID ',uint256(s.fid).toString(),' &#183; Captured through ',_date(s.anchorDay),'</text><text x="1136" y="735" text-anchor="end" fill="#857594" font-size="14">created by @nikolaii.eth with @viniapp</text></g></svg>'
        );
    }
    function _box(uint256 x,string memory value,string memory label) private pure returns(string memory) {
        return string.concat('<rect x="',x.toString(),'" y="520" width="347" height="170" rx="12" fill="#18131f" stroke="#352a43"/><text x="',(x+173).toString(),'" y="590" text-anchor="middle" fill="#f3eff9" font-size="34" font-weight="700">',value,'</text><text x="',(x+173).toString(),'" y="630" text-anchor="middle" fill="#a99aba" font-size="16">',label,'</text>');
    }
}

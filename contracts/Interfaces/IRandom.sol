// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol';

interface IRandom {
    enum Category {
        BASIC,
        RARE,
        SUPERRARE
    }
    event NftMinted(Category nftCategory, address indexed minter);

    function requestNft(address _to) external returns (uint256 requestId);

    function setWhitelist(address[] memory _whitelisted) external returns (address[] memory);

    function removeFromWhitelist(address _addresstoRemove) external;

    function isWhitelisted(address _checkAddress) external view returns (bool);

    function getChanceArray() external pure returns (uint256[3] memory);

    function getNftTokenUris(uint256 index) external view returns (string memory);

    function getTokenCounter() external view returns (uint256);
}

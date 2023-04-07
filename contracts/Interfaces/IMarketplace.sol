// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import '@openzeppelin/contracts/token/ERC721/IERC721.sol';

interface IMarketplace {
    struct Listing {
        uint256 price;
        address seller;
    }

    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ProceedsWithdrawed(address to, uint amount);

    event ItemCanceled(address indexed seller, address indexed nftAddress, uint256 indexed tokenId);

    function listItem(address nftAddress, uint256 tokenId, uint256 price) external;

    function buyItem(address nftAddress, uint256 tokenId) external payable;

    function cancelListing(address nftAddress, uint256 tokenId) external;

    function updateListing(address nftAddress, uint256 tokenId, uint256 newPrice) external;

    function withdrawProceeds() external;

    function setMarketplaceFee(uint _newMarketplaceFee) external returns (uint);

    function getListing(address nftAddress, uint256 tokenId) external view returns (Listing memory);

    function getProceeds(address seller) external view returns (uint256);

    function getMarketplaceFee() external view returns (uint);
}

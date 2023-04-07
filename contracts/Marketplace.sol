// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import './Interfaces/IMarketplace.sol';
import './Interfaces/IRegistry.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/utils/Context.sol';

contract Marketplace is IMarketplace, Context, ReentrancyGuard {
    using Address for address payable;

    // NFT contract address -> NFT TokenID -> Listing
    mapping(address => mapping(uint256 => Listing)) private listings;
    // seller address -> amount earned
    mapping(address => uint256) private proceeds;
    mapping(address => uint) private accumulatedSales;

    uint private marketplaceFee = 200; // 2%
    uint public constant SALES_TO_ACHIEVEMENT = 3;
    address private controlAddress;
    address private registryAddress;
    IRegistry internal registry;

    /*/////////////////////////////////////////////////////////////////// 
                                 MODIFIERS
    ///////////////////////////////////////////////////////////////////*/

    modifier notListed(
        address nftAddress,
        uint256 tokenId,
        address owner
    ) {
        require(listings[nftAddress][tokenId].price == 0, 'Marketplace: Already listed');
        _;
    }

    modifier isOwner(
        address nftAddress,
        uint256 tokenId,
        address spender
    ) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        require(spender == owner, 'Marketplace: Not owner');
        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId) {
        require(listings[nftAddress][tokenId].price > 0, 'Marketplace: Not listed');
        _;
    }

    modifier onlyControl() {
        _checkControlContract();
        _;
    }

    constructor(address _controlAddress, address _registryAddress) {
        controlAddress = _controlAddress;
        registryAddress = _registryAddress;
        registry = IRegistry(registryAddress);
    }

    /*/////////////////////////////////////////////////////////////////// 
                                 MAIN FUNCTIONS
    ///////////////////////////////////////////////////////////////////*/

    /// @notice List an NFT item for sale on the marketplace
    /// @param nftAddress - Address of the NFT contract
    /// @param tokenId - ID of the NFT to be listed
    /// @param price - Price of the NFT item
    /// @dev Requires that the provided price is greater than zero
    /// @dev Requires that the caller is the owner of the NFT item
    /// @dev Requires that the NFT item is not already listed on the marketplace by the caller
    /// @dev Requires that the NFT item is approved for transfer by the marketplace contract
    /// @dev Sets a new listing for the NFT item with the provided price and seller address
    /// @dev Emits an event to signal that a new NFT item has been listed on the marketplace

    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    )
        external
        notListed(nftAddress, tokenId, _msgSender())
        isOwner(nftAddress, tokenId, _msgSender())
    {
        require(price > 0, 'Marketplace: Price must be greater then zero');
        IERC721 nft = IERC721(nftAddress);
        require(
            nft.getApproved(tokenId) == address(this),
            'Marketplace: Not approved for marketplace'
        );
        listings[nftAddress][tokenId] = Listing(price, _msgSender());
        emit ItemListed(_msgSender(), nftAddress, tokenId, price);
    }

    /// @notice Function to buy an item listed for sale in the marketplace
    /// @param nftAddress - Address of the NFT contract of the item to be purchased
    /// @param tokenId - Token ID of the item to be purchased
    /// @dev It verifies that the item is listed for sale, and the buyer has sent the correct amount of native currency
    /// @dev It calculates and sends the marketplace fee to the Holder contract, and store the seller's proceeds to the seller
    /// @dev It deletes the listing from the marketplace and transfers the ownership of the item to the buyer
    /// @dev It increments the accumulated sales of the seller and mint achievement soulbound if the seller has achieved a sales milestone
    /// @dev It emits an event to signal that an item has been bought from the marketplace

    function buyItem(
        address nftAddress,
        uint256 tokenId
    ) external payable nonReentrant isListed(nftAddress, tokenId) {
        Listing memory listedItem = listings[nftAddress][tokenId];
        require(msg.value == listedItem.price, 'Marketplace: Price not met');
        uint marketplaceProceeds = (listedItem.price * marketplaceFee) / 10000;
        payable(registry.getHolderAddress()).sendValue(marketplaceProceeds);
        uint sellerProceeds = listedItem.price - marketplaceProceeds;
        proceeds[listedItem.seller] = proceeds[listedItem.seller] + sellerProceeds;
        delete (listings[nftAddress][tokenId]);
        IERC721(nftAddress).safeTransferFrom(listedItem.seller, _msgSender(), tokenId);
        accumulatedSales[listedItem.seller]++;
        if (accumulatedSales[listedItem.seller] >= SALES_TO_ACHIEVEMENT) {
            accumulatedSales[listedItem.seller] = 0;
            registry.getSoulboundsContract().salesAchievement(listedItem.seller);
        }
        emit ItemBought(_msgSender(), nftAddress, tokenId, listedItem.price);
    }

    /// @notice Allows the owner of a listed item to cancel the listing.
    /// @param nftAddress The address of the NFT contract.
    /// @param tokenId The ID of the token being canceled.
    /// @dev Emits an ItemCanceled event upon successful cancellation.

    function cancelListing(
        address nftAddress,
        uint256 tokenId
    ) external isOwner(nftAddress, tokenId, _msgSender()) isListed(nftAddress, tokenId) {
        delete (listings[nftAddress][tokenId]);
        emit ItemCanceled(_msgSender(), nftAddress, tokenId);
    }

    /// @dev Updates the price of an existing listing.
    /// @param nftAddress The address of the NFT contract.
    /// @param tokenId The ID of the NFT being listed.
    /// @param newPrice The new price for the NFT.

    function updateListing(
        address nftAddress,
        uint256 tokenId,
        uint256 newPrice
    ) external isListed(nftAddress, tokenId) isOwner(nftAddress, tokenId, _msgSender()) {
        listings[nftAddress][tokenId].price = newPrice;
        emit ItemListed(_msgSender(), nftAddress, tokenId, newPrice);
    }

    /// @notice Allows sellers to withdraw their proceeds from sales on the marketplace.
    /// @dev This function transfers the amount of proceeds that the caller is entitled to receive from previous sales,
    /// @dev sets their proceeds balance to zero, and emits a ProceedsWithdrawn event.

    function withdrawProceeds() external {
        uint256 toWithdraw = proceeds[_msgSender()];
        require(toWithdraw > 0, 'Marketplace: No Proceeds');
        proceeds[_msgSender()] = 0;
        (bool success, ) = payable(_msgSender()).call{value: toWithdraw}('');
        require(success, 'Marketplace: Transfer failed');
        emit ProceedsWithdrawed(_msgSender(), toWithdraw);
    }

    /// @notice Sets the marketplace fee.
    /// @dev Only the control role can call this function.
    /// @param _newMarketplaceFee The new marketplace fee to set.
    /// @return The new marketplace fee value.

    function setMarketplaceFee(uint _newMarketplaceFee) external onlyControl returns (uint) {
        require(marketplaceFee != _newMarketplaceFee, 'Marketplace: Fee the same');
        marketplaceFee = _newMarketplaceFee;
        return _newMarketplaceFee;
    }

    /*/////////////////////////////////////////////////////////////////// 
                                 GETTER FUNCTIONS
    ///////////////////////////////////////////////////////////////////*/

    function getListing(
        address nftAddress,
        uint256 tokenId
    ) external view returns (Listing memory) {
        return listings[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return proceeds[seller];
    }

    function getMarketplaceFee() external view returns (uint) {
        return marketplaceFee;
    }

    function _checkControlContract() internal view {
        require(_msgSender() == controlAddress, 'Marketplace: Caller is not control contract');
    }
}

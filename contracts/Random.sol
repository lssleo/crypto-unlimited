// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import './Interfaces/IRandom.sol';
import './Interfaces/IRegistry.sol';
import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol';
import '@openzeppelin/contracts/utils/Counters.sol';
import '@openzeppelin/contracts/utils/Context.sol';

contract Random is IRandom, VRFConsumerBaseV2, Context, ERC721URIStorage {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    // Chainlink VRF variables
    VRFCoordinatorV2Interface private immutable vrfCoordinator;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;
    // NFT variables
    uint256 internal constant MAX_CHANCE_VALUE = 100;
    string[] internal nftTokenUris;
    address private registryAddress;
    IRegistry internal registry;

    mapping(uint256 => address) public requestIdToSender;
    mapping(address => bool) internal whitelist;

    modifier onlyMinter() {
        _checkMinterContract();
        _;
    }

    constructor(
        address _registryAddress,
        address vrfCoordinatorV2,
        string[3] memory _nftTokenUris
    ) VRFConsumerBaseV2(vrfCoordinatorV2) ERC721('Random NFT', 'RN') {
        vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        nftTokenUris = _nftTokenUris;
        registryAddress = _registryAddress;
        registry = IRegistry(registryAddress);
    }

    /*/////////////////////////////////////////////////////////////////// 
                                 MAIN FUNCTIONS
    ///////////////////////////////////////////////////////////////////*/

    /// @notice Requests a random number from Chainlink VRF service
    /// @dev Only the Minter contract can call this function
    /// @param _to - Address where the NFT will be minted
    /// @return requestId - ID of the request from Chainlink VRF service

    function requestNft(address _to) external onlyMinter returns (uint256 requestId) {
        requestId = vrfCoordinator.requestRandomWords(
            registry.getGasLane(),
            registry.getSubscriptionId(),
            REQUEST_CONFIRMATIONS,
            registry.getCallbackGasLimit(),
            NUM_WORDS
        );
        requestIdToSender[requestId] = _to;
        return requestId;
    }

    /// @notice This function is called by the Chainlink VRF service to fulfill a random number request.
    /// @notice It mints a new NFT and assigns it to the address associated with the given `requestId`.
    /// @notice The `randomWords` parameter is an array of randomly generated words returned by the Chainlink VRF service.
    /// @notice The first element of the array is used to determine the NFT category based on a predefined chance value.
    /// @notice If the NFT category is SUPERRARE, the function also calls the `rareAchievement` function on the Soulbounds contract to award the rare achievement to the NFT owner.
    /// @notice Finally, the function emits a `NftMinted` event containing the NFT category and the address of the NFT owner.
    /// @param requestId The ID of the Chainlink VRF service request that generated the random number.
    /// @param randomWords An array of randomly generated words returned by the Chainlink VRF service.

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        address nftOwner = requestIdToSender[requestId];
        uint256 tokenId = _tokenIdCounter.current();
        uint256 moddedRng = randomWords[0] % MAX_CHANCE_VALUE;
        Category nftCategory = getCategoryFromModdedRng(moddedRng);
        _tokenIdCounter.increment();
        _safeMint(nftOwner, tokenId);
        _setTokenURI(tokenId, nftTokenUris[uint256(nftCategory)]);
        if (nftCategory == Category.SUPERRARE) {
            registry.getSoulboundsContract().rareAchievement(nftOwner);
        }

        emit NftMinted(nftCategory, nftOwner);
    }

    /*/////////////////////////////////////////////////////////////////// 
                                 SETTER FUNCTIONS
    ///////////////////////////////////////////////////////////////////*/

    /// @notice Adds or updates multiple addresses to the whitelist for minting NFTs
    /// @dev Only the Minter contract can call this function
    /// @param _whitelisted - Array of addresses to add or update to the whitelist
    /// @return address[] - The updated whitelist array

    function setWhitelist(
        address[] memory _whitelisted
    ) external onlyMinter returns (address[] memory) {
        for (uint256 i = 0; i < _whitelisted.length; i++) {
            whitelist[_whitelisted[i]] = true;
        }
        return _whitelisted;
    }

    function removeFromWhitelist(address _addresstoRemove) external onlyMinter {
        require(whitelist[_addresstoRemove] == true, 'Random: Not in whitelist');
        whitelist[_addresstoRemove] = false;
    }

    /*/////////////////////////////////////////////////////////////////// 
                                 GETTER FUNCTIONS
    ///////////////////////////////////////////////////////////////////*/

    function isWhitelisted(address _checkAddress) external view returns (bool) {
        return whitelist[_checkAddress];
    }

    /// @notice Determines the category of an NFT based on a provided random number
    /// @param moddedRng The randomly generated number modulo the maximum chance value
    /// @return The Category enum associated with the provided moddedRng value

    function getCategoryFromModdedRng(uint256 moddedRng) public pure returns (Category) {
        uint256 cumulativeSum = 0;
        uint256[3] memory chanceArray = getChanceArray();
        for (uint256 i = 0; i < chanceArray.length; i++) {
            if (moddedRng >= cumulativeSum && moddedRng < cumulativeSum + chanceArray[i]) {
                return Category(i);
            }
            cumulativeSum += chanceArray[i];
        }
        revert('Random: Range out of bounds');
    }

    function getChanceArray() public pure returns (uint256[3] memory) {
        return [10, 30, MAX_CHANCE_VALUE]; // 10% - index 0 , 30% - index 1, 100 - (10+30) = 60 % - index 2
    }

    function getNftTokenUris(uint256 index) public view returns (string memory) {
        return nftTokenUris[index];
    }

    function getTokenCounter() public view returns (uint256) {
        return _tokenIdCounter.current();
    }

    function _checkMinterContract() internal view {
        require(_msgSender() == registry.getMinterAddress(), 'Random: Caller not minter');
    }
}

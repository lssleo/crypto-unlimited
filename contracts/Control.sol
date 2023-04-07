// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import './Interfaces/IControl.sol';
import './Libraries/ControlLibrary.sol';
import './Interfaces/IRegistry.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';

contract Control is IControl, AccessControl {
    using ControlLibrary for bytes32;

    address private registryAddress;
    IRegistry internal registry;

    constructor(
        address _registryRole,
        address _marketplaceRole,
        address _minterRole,
        address _soulboundsRole
    ) {
        _grantRole(ControlLibrary.REGISTRY_ROLE, _registryRole);
        _grantRole(ControlLibrary.MARKETPLACE_ROLE, _marketplaceRole);
        _grantRole(ControlLibrary.MINTER_ROLE, _minterRole);
        _grantRole(ControlLibrary.SOULBOUNDS_ROLE, _soulboundsRole);
    }

    /*/////////////////////////////////////////////////////////////////// 
                                 MAIN FUNCTIONS
    ///////////////////////////////////////////////////////////////////*/

    /// @notice Method to set the address of the Registry contract by a user with the 'REGISTRY_ROLE' role
    /// @param _registryAddress - Address of the Registry contract to be set
    /// @dev It verifies that the provided address is not the zero address and not the current address of the Registry contract
    /// @dev It sets the provided address as the new address of the Registry contract
    /// @dev It emits an event to signal that the address of the Registry contract has been updated

    function setRegistry(address _registryAddress) external onlyRole(ControlLibrary.REGISTRY_ROLE) {
        require(_registryAddress != address(0x0), 'Control: Zero address');
        require(_registryAddress != registryAddress, 'Control: Setting the same value');
        registryAddress = _registryAddress;
        registry = IRegistry(registryAddress);
        emit RegistryContractSet(_registryAddress);
    }

    /// @notice Set the new marketplace fee
    /// @param _newFee The new marketplace fee percentage ( / 10000 )
    /// @dev The function requires the caller to have the MARKETPLACE_ROLE
    /// @dev The function calls the setMarketplaceFee function of the IMarketplace contract instance obtained from the registry
    /// @dev It emits the MarketplaceFeeUpdated event with the new marketplace fee percentage

    function setMarketplaceFee(uint _newFee) external onlyRole(ControlLibrary.MARKETPLACE_ROLE) {
        uint newMarketplaceFee = registry.getMarketplaceContract().setMarketplaceFee(_newFee);
        emit MarketplaceFeeUpdated(newMarketplaceFee);
    }

    /// @notice Method to set the new price for minting an NFT by a user with the 'MINTER_ROLE' role
    /// @param _newPrice - New price to be set for minting an NFT
    /// @dev It verifies that the caller has the 'MINTER_ROLE' role
    /// @dev It sets the provided price as the new price for minting an NFT
    /// @dev It emits an event to signal that the price for minting an NFT has been updated

    function setPriceMinter(uint _newPrice) external onlyRole(ControlLibrary.MINTER_ROLE) {
        uint newPrice = registry.getMinterContract().setPrice(_newPrice);
        emit PriceMinterUpdated(newPrice);
    }

    /// @notice Method to set the currency address used by the Minter contract to accept payments in tokens by a user with the 'MINTER_ROLE' role
    /// @param _newCurrency - Address of the new currency to be set
    /// @dev It verifies that the provided address is not the current currency address
    /// @dev It sets the provided address as the new currency address for the Minter contract
    /// @dev It emits an event to signal that the currency address used by the Minter contract has been updated

    function setCurrencyMinter(address _newCurrency) external onlyRole(ControlLibrary.MINTER_ROLE) {
        address newCurrency = registry.getMinterContract().setCurrency(_newCurrency);
        emit CurrencyMinterUpdated(newCurrency);
    }

    /// @notice Method to set the addresses that will be whitelisted by a user with the 'MINTER_ROLE' role
    /// @param _addresses - Array of addresses to be whitelisted
    /// @dev It sets the provided addresses as the new whitelisted addresses
    /// @dev It emits an event to signal that the whitelisted addresses have been updated

    function setWhitelistMinter(
        address[] memory _addresses
    ) external onlyRole(ControlLibrary.MINTER_ROLE) {
        address[] memory newWhitelisted = registry.getMinterContract().setWhitelist(_addresses);
        emit WhitelistMinterUpdated(newWhitelisted);
    }

    /// @notice Method to activate the generation of new NFTs by a user with the 'MINTER_ROLE' role
    /// @dev It verifies that the calling user has the 'MINTER_ROLE' role
    /// @dev It activates the generation of new NFTs by calling the 'activateGeneration' method of the Minter contract stored in the Registry contract
    /// @dev It emits an event to signal that the Minter has been activated, with the status of the generation

    function activateMinter() external onlyRole(ControlLibrary.MINTER_ROLE) {
        bool generationStatus = registry.getMinterContract().activateGeneration();
        emit MinterActivated(generationStatus);
    }

    /// @notice Method to disable the generation of new NFTs by a user with the 'MINTER_ROLE' role
    /// @dev It calls the 'disableGeneration' function of the Minter contract and returns the generation status
    /// @dev It emits an event to signal that the generation of new NFTs has been disabled

    function disableMinter() external onlyRole(ControlLibrary.MINTER_ROLE) {
        bool generationStatus = registry.getMinterContract().disableGeneration();
        emit MinterDisabled(generationStatus);
    }

    /// @notice Mint a specified amount of Soulbound tokens with the specified ID to a specified address, by a user with the 'SOULBOUNDS_ROLE' role
    /// @param _to - The address that will receive the minted tokens
    /// @param _tokenId - The ID of the token to be minted
    /// @param _amount - The amount of tokens to be minted
    /// @dev It calls the 'mint' function of the Soulbounds contract, passing the provided parameters
    /// @dev It emits an event with information about the minted tokens (to, tokenId, amount)

    function mintSoulbounds(
        address _to,
        uint _tokenId,
        uint _amount
    ) external onlyRole(ControlLibrary.SOULBOUNDS_ROLE) {
        (address to, uint tokenId, uint amount) = registry.getSoulboundsContract().mint(
            _to,
            _tokenId,
            _amount
        );
        emit SoulboundsMinted(to, tokenId, amount);
    }

    /// @notice Method to set the metadata URI and soulbound status of a soulbound token by a user with the 'SOULBOUNDS_ROLE' role
    /// @param _tokenId - ID of the soulbound token to be set
    /// @param _tokenUri - Metadata URI to be set for the soulbound token
    /// @param _soulbound - Soulbound status to be set for the soulbound token
    /// @dev It sets the metadata URI and soulbound status of the specified soulbound token
    /// @dev It emits an event to signal that the metadata URI and soulbound status of the soulbound token have been updated

    function setSoulboundToken(
        uint _tokenId,
        string memory _tokenUri,
        bool _soulbound
    ) external onlyRole(ControlLibrary.SOULBOUNDS_ROLE) {
        (uint tokenId, string memory tokenUri, bool soulbound) = registry
            .getSoulboundsContract()
            .setToken(_tokenId, _tokenUri, _soulbound);
        emit SoulboundTokenSet(tokenId, tokenUri, soulbound);
    }

    function getRegistryAddress() external view returns (address) {
        return registryAddress;
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import '@openzeppelin/contracts/access/Ownable.sol';
import './Interfaces/IRegistry.sol';

contract Registry is IRegistry, Ownable {
    address private holderAddress;
    address private marketplaceAddress;
    address private minterAddress;
    address private randomAddress;
    address private soulboundsAddress;

    uint64 private subscriptionId;
    bytes32 private gasLane;
    uint32 private callbackGasLimit;

    IMarketplace internal marketplaceContract;
    IMinter internal minterContract;
    IRandom internal randomContract;
    ISoulbounds internal soulboundsContract;

    modifier notZeroAddress(address _address) {
        require(_address != address(0x0), 'Registry: Zero address');
        _;
    }

    constructor() {}

    /*/////////////////////////////////////////////////////////////////// 
                                 SETTER FUNCTIONS
    ///////////////////////////////////////////////////////////////////*/

    function setMinterContract(address _newAddress) external onlyOwner notZeroAddress(_newAddress) {
        require(_newAddress != minterAddress, 'Registry: Setting the same value');
        minterAddress = _newAddress;
        minterContract = IMinter(minterAddress);
        emit MinterAddressUpdated(minterAddress);
    }

    function setMarketplaceContract(
        address _newAddress
    ) external onlyOwner notZeroAddress(_newAddress) {
        require(_newAddress != marketplaceAddress, 'Registry: Setting the same value');
        marketplaceAddress = _newAddress;
        marketplaceContract = IMarketplace(marketplaceAddress);
        emit MarketplaceAddressUpdated(marketplaceAddress);
    }

    function setRandomContract(address _newAddress) external onlyOwner notZeroAddress(_newAddress) {
        require(_newAddress != randomAddress, 'Registry: Setting the same value');
        randomAddress = _newAddress;
        randomContract = IRandom(randomAddress);
        emit RandomAddressUpdated(randomAddress);
    }

    function setSoulboundsContract(
        address _newAddress
    ) external onlyOwner notZeroAddress(_newAddress) {
        require(_newAddress != soulboundsAddress, 'Registry: Setting the same value');
        soulboundsAddress = _newAddress;
        soulboundsContract = ISoulbounds(soulboundsAddress);
        emit SoulboundsAddressUpdated(soulboundsAddress);
    }

    function setHolderAddress(address _newAddress) external onlyOwner notZeroAddress(_newAddress) {
        require(_newAddress != holderAddress, 'Registry: Setting the same value');
        holderAddress = _newAddress;
        emit HolderAddressUpdated(holderAddress);
    }

    function setOracleParams(
        uint64 _subscriptionId,
        bytes32 _gasLane,
        uint32 _callbackGasLimit
    ) external onlyOwner {
        subscriptionId = _subscriptionId;
        gasLane = _gasLane;
        callbackGasLimit = _callbackGasLimit;
        emit OracleParamsUpdated(subscriptionId, gasLane, callbackGasLimit);
    }

    /*/////////////////////////////////////////////////////////////////// 
                                 GETTER FUNCTIONS
    ///////////////////////////////////////////////////////////////////*/

    function getMinterContract() external view returns (IMinter) {
        return minterContract;
    }

    function getMarketplaceContract() external view returns (IMarketplace) {
        return marketplaceContract;
    }

    function getRandomContract() external view returns (IRandom) {
        return randomContract;
    }

    function getSoulboundsContract() external view returns (ISoulbounds) {
        return soulboundsContract;
    }

    function getMinterAddress() external view returns (address) {
        return minterAddress;
    }

    function getMarketplaceAddress() external view returns (address) {
        return marketplaceAddress;
    }

    function getRandomAddress() external view returns (address) {
        return randomAddress;
    }

    function getSoulboundsAddress() external view returns (address) {
        return soulboundsAddress;
    }

    function getHolderAddress() external view returns (address) {
        return holderAddress;
    }

    function getGasLane() external view returns (bytes32) {
        return gasLane;
    }

    function getSubscriptionId() external view returns (uint64) {
        return subscriptionId;
    }

    function getCallbackGasLimit() external view returns (uint32) {
        return callbackGasLimit;
    }

    function getOwner() external view returns (address) {
        return owner();
    }
}

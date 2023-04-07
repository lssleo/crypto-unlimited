// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import './IMarketplace.sol';
import './IMinter.sol';
import './IRandom.sol';
import './ISoulbounds.sol';

interface IRegistry {
    event HolderAddressUpdated(address indexed newAddress);
    event MarketplaceAddressUpdated(address indexed newAddress);
    event MinterAddressUpdated(address indexed newAddress);
    event RandomAddressUpdated(address indexed newAddress);
    event SoulboundsAddressUpdated(address indexed newAddress);
    event OracleParamsUpdated(uint64 subscriptionId, bytes32 gasLane, uint32 callbackGasLimit);

    function getOwner() external view returns (address);

    function setMinterContract(address _newAddress) external;

    function setMarketplaceContract(address _newAddress) external;

    function setRandomContract(address _newAddress) external;

    function setSoulboundsContract(address _newAddress) external;

    function setHolderAddress(address _newAddress) external;

    function setOracleParams(
        uint64 _subscriptionId,
        bytes32 _gasLane,
        uint32 _callbackGasLimit
    ) external;

    function getMinterContract() external view returns (IMinter);

    function getMarketplaceContract() external view returns (IMarketplace);

    function getRandomContract() external view returns (IRandom);

    function getSoulboundsContract() external view returns (ISoulbounds);

    function getMinterAddress() external view returns (address);

    function getMarketplaceAddress() external view returns (address);

    function getRandomAddress() external view returns (address);

    function getSoulboundsAddress() external view returns (address);

    function getHolderAddress() external view returns (address);

    function getGasLane() external view returns (bytes32);

    function getSubscriptionId() external view returns (uint64);

    function getCallbackGasLimit() external view returns (uint32);
}

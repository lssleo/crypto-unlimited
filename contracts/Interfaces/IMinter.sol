// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

interface IMinter {
    event ItemRequested(uint requestId, address to);

    function requestItem() external payable;

    function setPrice(uint _newPrice) external returns (uint);

    function setCurrency(address _newCurrency) external returns (address);

    function setWhitelist(address[] memory whitelisted) external returns (address[] memory);

    function disableGeneration() external returns (bool);

    function activateGeneration() external returns (bool);

    function getPrice() external view returns (uint);

    function getCurrency() external view returns (address);

    function getStatus() external view returns (bool);
}

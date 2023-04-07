// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import '@openzeppelin/contracts/access/IAccessControl.sol';

// import IRegistry

interface IControl {
    event RegistryContractSet(address indexed newAddress);
    event MarketplaceFeeUpdated(uint newFee);
    event PriceMinterUpdated(uint newPrice);
    event CurrencyMinterUpdated(address newCurrency);
    event WhitelistMinterUpdated(address[] indexed newWhitelisted);
    event MinterActivated(bool minterStatus);
    event MinterDisabled(bool minterStatus);
    event SoulboundsMinted(address to, uint tokenId, uint amount);
    event SoulboundTokenSet(uint tokenId, string tokenUri, bool isSoulbound);

    function setRegistry(address _registryAddress) external;

    function setMarketplaceFee(uint _newFee) external;

    function setPriceMinter(uint _newPrice) external;

    function setCurrencyMinter(address _newCurrency) external;

    function setWhitelistMinter(address[] calldata _addresses) external;

    function activateMinter() external;

    function disableMinter() external;

    function mintSoulbounds(address _to, uint _tokenId, uint _amount) external;

    function setSoulboundToken(uint _tokenId, string memory _tokenUri, bool _soulbound) external;

    function getRegistryAddress() external view returns (address);
}

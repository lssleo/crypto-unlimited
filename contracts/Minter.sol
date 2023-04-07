// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import './Interfaces/IMinter.sol';
import './Interfaces/IRegistry.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/utils/Context.sol';

contract Minter is IMinter, Context {
    using Address for address payable;

    uint private price;
    address private currency;
    bool private active;
    address private controlAddress;
    address private registryAddress;
    IRegistry internal registry;

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

    /// @notice Requests an NFT from a random contract using Ether or tokens.
    /// @dev Requires that the generation is active and the price is greater than 0.
    /// @dev If the caller is whitelisted, the request is free and a request ID is returned.
    /// @dev If the caller is not whitelisted, the payment is processed using Ether or tokens, depending on the currency set.
    /// @dev requestId - Request ID of the NFT request
    /// @dev _msgSender() - Address of the requester

    function requestItem() external payable {
        require(active && price > 0, 'Minter: Generation not active');
        uint requestId;
        if (registry.getRandomContract().isWhitelisted(_msgSender())) {
            require(msg.value == 0, 'Minter: Free mint from whitelist');
            registry.getRandomContract().removeFromWhitelist(_msgSender());
            requestId = registry.getRandomContract().requestNft(_msgSender());
        } else {
            if (currency != address(0x0)) {
                require(
                    IERC20(currency).transferFrom(_msgSender(), registry.getHolderAddress(), price),
                    'Minter: Tokens not transferred'
                );
                requestId = registry.getRandomContract().requestNft(_msgSender());
            } else {
                require(msg.value == price, 'Minter: Price not met');
                payable(registry.getHolderAddress()).sendValue(price);
                requestId = registry.getRandomContract().requestNft(_msgSender());
            }
        }

        emit ItemRequested(requestId, _msgSender());
    }

    /*/////////////////////////////////////////////////////////////////// 
                                 SETTER FUNCTIONS
    ///////////////////////////////////////////////////////////////////*/

    /// @notice Updates the price for requesting an item
    /// @param _newPrice The new price to be set
    /// @return The updated price
    /// @dev This function can only be called by the contract with the control role
    /// @dev It verifies that the new price is not zero and is different from the current price

    function setPrice(uint _newPrice) external onlyControl returns (uint) {
        require(_newPrice != 0, 'Minter: Price cant be zero');
        require(price != _newPrice, 'Minter: Price the same');
        price = _newPrice;
        return _newPrice;
    }

    /// @notice Sets the address of the currency used for generating an NFT
    /// @param _newCurrency The address of the new currency contract to be set
    /// @return The address of the new currency contract
    /// @dev Only the contract with the control role can call this function
    /// @dev Verifies that the provided address is not the current currency address

    function setCurrency(address _newCurrency) external onlyControl returns (address) {
        require(currency != _newCurrency, 'Minter: Currency the same');
        currency = _newCurrency;
        return _newCurrency;
    }

    /// @notice Sets the addresses of users to be whitelisted for free minting by a contract with the control role
    /// @param whitelisted - Array of addresses of users to be added to the whitelist
    /// @dev It calls the 'setWhitelist' function of the 'Random' contract through the 'Registry' contract
    /// @dev It returns the updated array of whitelisted addresses
    /// @dev Only a contract with the control role can call this function

    function setWhitelist(
        address[] memory whitelisted
    ) external onlyControl returns (address[] memory) {
        address[] memory newWhitelisted = registry.getRandomContract().setWhitelist(whitelisted);
        return newWhitelisted;
    }

    /// @notice Method to disable the item generation process by a contract with the control role
    /// @dev It verifies that the generation process is currently active
    /// @dev It sets the active flag to false to disable the generation process
    /// @return A boolean indicating whether the generation process is currently active or not

    function disableGeneration() external onlyControl returns (bool) {
        require(active == true, 'Minter: Generation not active');
        active = false;
        return active;
    }

    /// @notice Method to activate NFT generation by a contract with the control role
    /// @dev It verifies that NFT generation is not already active
    /// @dev It sets the active state to true to enable NFT generation
    /// @return The current active state

    function activateGeneration() external onlyControl returns (bool) {
        require(active != true, 'Minter: Generation already active');
        active = true;
        return active;
    }

    /*/////////////////////////////////////////////////////////////////// 
                                 GETTER FUNCTIONS
    ///////////////////////////////////////////////////////////////////*/

    function getPrice() external view returns (uint) {
        return price;
    }

    function getCurrency() external view returns (address) {
        return currency;
    }

    function getStatus() external view returns (bool) {
        return active;
    }

    function _checkControlContract() internal view {
        require(_msgSender() == controlAddress, 'Minter: Caller is not control contract');
    }
}

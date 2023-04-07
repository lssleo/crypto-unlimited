// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import '@openzeppelin/contracts/finance/PaymentSplitter.sol';

/// @title Holder contract
/// @notice Contract that inherits from OpenZeppelin's PaymentSplitter contract to split payments among multiple payees

contract Holder is PaymentSplitter {
    /// @notice Constructor function that sets up the initial payees and their corresponding shares
    /// @param payees List of addresses that will receive payments
    /// @param shares_ List of shares that correspond to each payee

    constructor(
        address[] memory payees,
        uint256[] memory shares_
    ) PaymentSplitter(payees, shares_) {}
}

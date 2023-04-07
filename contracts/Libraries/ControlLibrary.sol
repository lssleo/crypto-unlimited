// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

library ControlLibrary {
    bytes32 public constant REGISTRY_ROLE = keccak256('REGISTRY_ROLE');
    bytes32 public constant MARKETPLACE_ROLE = keccak256('MARKETPLACE_ROLE');
    bytes32 public constant MINTER_ROLE = keccak256('MINTER_ROLE');
    bytes32 public constant SOULBOUNDS_ROLE = keccak256('SOULBOUNDS_ROLE');
}

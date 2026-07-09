// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Community} from "../Types.sol";

interface IIdentityRegistry {
    function isActiveMember(address wallet) external view returns (bool);
    function communityOf(address wallet) external view returns (Community);
    function nullifierOf(address wallet) external view returns (bytes32);
    function memberCount(Community community) external view returns (uint256);
    function totalMembers() external view returns (uint256);
}

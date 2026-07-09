// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ITreasury {
    function balance() external view returns (uint256);
    /// @notice Transfer reserve asset out. Authorized spenders only.
    function release(address to, uint256 amount) external;
}

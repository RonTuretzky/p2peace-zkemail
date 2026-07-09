// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPeaceMinter {
    /// @notice Burn caller's tokens and pay out reserve asset 1:1.
    function redeem(uint256 tokenAmount) external;
    /// @notice Pull `usdAmount` reserve asset from the caller, mint tokens 1:1 into
    ///         the community pool as claimable rewards. Authorized callers only
    ///         (RedistributionEngine, SanctionsEscrow).
    function mintAtPar(uint256 usdAmount) external;
}

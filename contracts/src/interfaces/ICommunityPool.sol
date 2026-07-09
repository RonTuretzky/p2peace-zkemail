// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICommunityPool {
    /// @notice Corpus staked by minters, at risk of redistribution.
    function corpusBalance() external view returns (uint256);
    /// @notice Register newly transferred stake tokens into the corpus. Minter only.
    function notifyStake(uint256 amount) external;
    /// @notice Register newly transferred reward tokens for equal-per-member claims.
    function notifyReward(uint256 amount) external;
    /// @notice Move up to `amount` of corpus to the engine. Engine only.
    /// @return actual amount transferred (capped by corpus).
    function slashCorpus(uint256 amount) external returns (uint256 actual);
    /// @notice Snapshot the reward accumulator for a newly enrolled member.
    ///         IdentityRegistry only.
    function initMember(bytes32 nullifier) external;
}

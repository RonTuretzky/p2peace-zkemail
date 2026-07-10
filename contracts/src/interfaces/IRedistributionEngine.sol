// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IRedistributionEngine {
    /// @notice Called by EventAttestation when a round meets its source thresholds.
    /// @return eventId engine-scoped id of the pending event.
    function onEventConfirmed(uint256 incentiveId, uint256 roundId)
        external
        returns (uint256 eventId);
    function isFinalized(uint256 eventId) external view returns (bool);
    function incentiveOf(uint256 eventId) external view returns (uint256);
}

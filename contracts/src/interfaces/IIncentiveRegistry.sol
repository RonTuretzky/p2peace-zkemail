// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Direction, SourceCategory} from "../Types.sol";

interface IIncentiveRegistry {
    struct IncentiveView {
        address proposer;
        Direction direction;
        bytes32 patternHash;
        uint16 requiredA;
        uint16 requiredB;
        uint16 requiredIntl;
        uint32 attestationWindow; // seconds; "same event" span for email timestamps
        uint16 redistributionBps; // of pool corpus (harmful) / treasury (positive)
        uint16 maxTriggers;
        uint32 triggerCooldown; //  seconds between confirmed events
        uint16 triggerCount;
        uint64 lastTriggeredAt;
    }

    function getIncentive(uint256 id) external view returns (IncentiveView memory);
    function isActive(uint256 id) external view returns (bool);
    function sourceCategory(uint256 id, bytes32 domainHash) external view returns (SourceCategory);
    /// @notice Bump trigger bookkeeping when a round confirms. EventAttestation only.
    function onTriggered(uint256 id) external;
    /// @notice Roll back a trigger count when the council reverses an event.
    ///         RedistributionEngine only. Cooldown is deliberately not rolled back.
    function onReversed(uint256 id) external;
}

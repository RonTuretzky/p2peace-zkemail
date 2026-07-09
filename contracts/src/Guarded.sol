// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Emergency pause with a hard expiry: the guardian can halt attestation and
///         redistribution (never funds custody) for at most MAX_PAUSE at a time.
///         An absent or compromised guardian therefore cannot brick the protocol —
///         every pause self-heals.
abstract contract Guarded {
    uint256 public constant MAX_PAUSE = 14 days;

    address public guardian;
    uint64 public pausedUntil;

    event GuardianSet(address indexed guardian);
    event Paused(uint64 until);
    event Unpaused();

    error NotGuardian();
    error PauseTooLong();
    error CurrentlyPaused();

    modifier onlyGuardian() {
        if (msg.sender != guardian) revert NotGuardian();
        _;
    }

    modifier whenNotPaused() {
        if (block.timestamp < pausedUntil) revert CurrentlyPaused();
        _;
    }

    constructor(address guardian_) {
        guardian = guardian_;
        emit GuardianSet(guardian_);
    }

    function pause(uint256 duration) external onlyGuardian {
        if (duration > MAX_PAUSE) revert PauseTooLong();
        pausedUntil = uint64(block.timestamp + duration);
        emit Paused(pausedUntil);
    }

    function unpause() external onlyGuardian {
        pausedUntil = 0;
        emit Unpaused();
    }

    function _setGuardian(address guardian_) internal {
        guardian = guardian_;
        emit GuardianSet(guardian_);
    }
}

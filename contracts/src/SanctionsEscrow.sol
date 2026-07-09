// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {PeaceMinter} from "./PeaceMinter.sol";
import {IRedistributionEngine} from "./interfaces/IRedistributionEngine.sol";

/// @notice Tokenized external incentives ("sanctions relief"): outside parties —
///         states, NGOs, diaspora — escrow reserve assets against a specific
///         incentive. When that incentive produces a *finalized* event, the tranche
///         releases to the chosen beneficiary; if it never does, the donor reclaims
///         after expiry. Conditions are transparent and immutable at deposit time —
///         no shifting goalposts.
contract SanctionsEscrow {
    using SafeERC20 for IERC20;

    enum Beneficiary {
        PoolA,
        PoolB,
        Both,
        Treasury
    }

    struct Tranche {
        address donor;
        uint256 incentiveId;
        Beneficiary beneficiary;
        uint256 amount;
        uint64 expiry;
        bool released;
        bool reclaimed;
    }

    IERC20 public immutable usd;
    IRedistributionEngine public immutable engine;
    PeaceMinter public immutable minterA;
    PeaceMinter public immutable minterB;
    address public immutable treasury;

    uint256 public trancheCount;
    mapping(uint256 => Tranche) public tranches;

    event Deposited(
        uint256 indexed trancheId,
        address indexed donor,
        uint256 indexed incentiveId,
        Beneficiary beneficiary,
        uint256 amount,
        uint64 expiry
    );
    event Released(uint256 indexed trancheId, uint256 indexed eventId);
    event Reclaimed(uint256 indexed trancheId);

    error BadTranche();
    error TrancheClosed();
    error EventNotFinalized();
    error EventIncentiveMismatch();
    error NotDonor();
    error NotExpired();

    constructor(
        IERC20 usd_,
        IRedistributionEngine engine_,
        PeaceMinter minterA_,
        PeaceMinter minterB_,
        address treasury_
    ) {
        usd = usd_;
        engine = engine_;
        minterA = minterA_;
        minterB = minterB_;
        treasury = treasury_;
    }

    function deposit(uint256 incentiveId, Beneficiary beneficiary, uint256 amount, uint64 expiry)
        external
        returns (uint256 trancheId)
    {
        if (amount == 0 || expiry <= block.timestamp) revert BadTranche();
        usd.safeTransferFrom(msg.sender, address(this), amount);
        trancheId = ++trancheCount;
        tranches[trancheId] = Tranche({
            donor: msg.sender,
            incentiveId: incentiveId,
            beneficiary: beneficiary,
            amount: amount,
            expiry: expiry,
            released: false,
            reclaimed: false
        });
        emit Deposited(trancheId, msg.sender, incentiveId, beneficiary, amount, expiry);
    }

    /// @notice Anyone may trigger release by pointing at a finalized event of the
    ///         tranche's incentive. Valid until the donor reclaims — finalization is
    ///         public 48h in advance, so beneficiaries always have time to act first.
    function release(uint256 trancheId, uint256 eventId) external {
        Tranche storage t = tranches[trancheId];
        if (t.donor == address(0)) revert BadTranche();
        if (t.released || t.reclaimed) revert TrancheClosed();
        if (!engine.isFinalized(eventId)) revert EventNotFinalized();
        if (engine.incentiveOf(eventId) != t.incentiveId) revert EventIncentiveMismatch();
        t.released = true;

        if (t.beneficiary == Beneficiary.Treasury) {
            usd.safeTransfer(treasury, t.amount);
        } else if (t.beneficiary == Beneficiary.PoolA) {
            _parInto(minterA, t.amount);
        } else if (t.beneficiary == Beneficiary.PoolB) {
            _parInto(minterB, t.amount);
        } else {
            uint256 half = t.amount / 2;
            _parInto(minterA, half);
            _parInto(minterB, t.amount - half);
        }
        emit Released(trancheId, eventId);
    }

    function reclaim(uint256 trancheId) external {
        Tranche storage t = tranches[trancheId];
        if (msg.sender != t.donor) revert NotDonor();
        if (t.released || t.reclaimed) revert TrancheClosed();
        if (block.timestamp <= t.expiry) revert NotExpired();
        t.reclaimed = true;
        usd.safeTransfer(t.donor, t.amount);
        emit Reclaimed(trancheId);
    }

    function _parInto(PeaceMinter minter, uint256 amount) internal {
        if (amount == 0) return;
        usd.forceApprove(address(minter), amount);
        minter.mintAtPar(amount);
    }
}

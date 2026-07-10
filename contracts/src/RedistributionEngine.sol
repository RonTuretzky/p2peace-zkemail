// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Direction} from "./Types.sol";
import {Guarded} from "./Guarded.sol";
import {PeaceMinter} from "./PeaceMinter.sol";
import {CommunityPool} from "./CommunityPool.sol";
import {ITreasury} from "./interfaces/ITreasury.sol";
import {IIncentiveRegistry} from "./interfaces/IIncentiveRegistry.sol";
import {IRedistributionEngine} from "./interfaces/IRedistributionEngine.sol";

/// @notice Executes confirmed events after the dispute window.
///
///         State machine per event:
///           CONFIRMED (by EventAttestation, amount planned & snapshotted)
///             → 48h public-notice window: anyone can inspect the event; the
///               guardian's auto-expiring pause is the emergency brake
///             → FINALIZED: value moves — and only here does value move.
///
///         Value routes (reserve backing preserved on both sides):
///           HarmfulByX:  slash pool X corpus (tokens) → redeem 1:1 to USD at
///                        minter X → mint 1:1 at minter Y into pool Y rewards.
///           PositiveForX: USD from Treasury → mint 1:1 at minter X into pool X.
///           Joint:        Treasury USD split 50/50 into both pools.
contract RedistributionEngine is Ownable, Guarded, IRedistributionEngine {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;

    enum EventStatus {
        None,
        Pending,
        Finalized
    }

    struct PendingEvent {
        uint256 incentiveId;
        uint256 roundId;
        Direction direction;
        uint256 planned; // tokens for Harmful*, USD for Positive*/Joint
        uint64 confirmedAt;
        EventStatus status;
    }

    IERC20 public immutable usd;
    IIncentiveRegistry public immutable incentives;
    ITreasury public immutable treasury;
    CommunityPool public immutable poolA;
    CommunityPool public immutable poolB;
    PeaceMinter public immutable minterA;
    PeaceMinter public immutable minterB;

    address public attestation;
    uint32 public disputeWindow = 48 hours;

    uint256 public eventCount;
    mapping(uint256 => PendingEvent) public events;

    event Wired(address attestation);
    event EventConfirmed(
        uint256 indexed eventId, uint256 indexed incentiveId, Direction direction, uint256 planned
    );
    event EventFinalized(uint256 indexed eventId, uint256 moved);
    event DisputeWindowSet(uint32 window);

    error AlreadyWired();
    error NotAttestation();
    error UnknownEvent();
    error NotPending();
    error DisputeWindowOpen();
    error BadWindow();

    constructor(
        address owner_,
        address guardian_,
        IERC20 usd_,
        IIncentiveRegistry incentives_,
        ITreasury treasury_,
        CommunityPool poolA_,
        CommunityPool poolB_,
        PeaceMinter minterA_,
        PeaceMinter minterB_
    ) Ownable(owner_) Guarded(guardian_) {
        usd = usd_;
        incentives = incentives_;
        treasury = treasury_;
        poolA = poolA_;
        poolB = poolB_;
        minterA = minterA_;
        minterB = minterB_;
    }

    function wire(address attestation_) external onlyOwner {
        if (attestation != address(0)) revert AlreadyWired();
        attestation = attestation_;
        emit Wired(attestation_);
    }

    function setDisputeWindow(uint32 window) external onlyOwner {
        // 5-minute floor for demo/testnet cycles; production stays at 48h.
        if (window < 5 minutes || window > 7 days) revert BadWindow();
        disputeWindow = window;
        emit DisputeWindowSet(window);
    }

    function setGuardian(address guardian_) external onlyOwner {
        _setGuardian(guardian_);
    }

    // ------------------------------------------------------------ confirmation

    function onEventConfirmed(uint256 incentiveId, uint256 roundId)
        external
        returns (uint256 eventId)
    {
        if (msg.sender != attestation) revert NotAttestation();
        IIncentiveRegistry.IncentiveView memory inc = incentives.getIncentive(incentiveId);

        uint256 planned;
        if (inc.direction == Direction.HarmfulByA) {
            planned = poolA.corpusBalance() * inc.redistributionBps / BPS;
        } else if (inc.direction == Direction.HarmfulByB) {
            planned = poolB.corpusBalance() * inc.redistributionBps / BPS;
        } else {
            planned = treasury.balance() * inc.redistributionBps / BPS;
        }

        eventId = ++eventCount;
        events[eventId] = PendingEvent({
            incentiveId: incentiveId,
            roundId: roundId,
            direction: inc.direction,
            planned: planned,
            confirmedAt: uint64(block.timestamp),
            status: EventStatus.Pending
        });
        emit EventConfirmed(eventId, incentiveId, inc.direction, planned);
    }

    // ------------------------------------------------------------- resolution

    /// @notice Anyone may finalize once the dispute window has passed.
    function finalize(uint256 eventId) external whenNotPaused {
        PendingEvent storage evt = events[eventId];
        if (evt.status == EventStatus.None) revert UnknownEvent();
        if (evt.status != EventStatus.Pending) revert NotPending();
        if (block.timestamp < uint256(evt.confirmedAt) + disputeWindow) {
            revert DisputeWindowOpen();
        }
        evt.status = EventStatus.Finalized;

        uint256 moved;
        Direction d = evt.direction;
        if (d == Direction.HarmfulByA) {
            moved = _slashInto(poolA, minterA, minterB, evt.planned);
        } else if (d == Direction.HarmfulByB) {
            moved = _slashInto(poolB, minterB, minterA, evt.planned);
        } else if (d == Direction.PositiveForA) {
            moved = _treasuryInto(minterA, evt.planned);
        } else if (d == Direction.PositiveForB) {
            moved = _treasuryInto(minterB, evt.planned);
        } else {
            uint256 half = evt.planned / 2;
            moved = _treasuryInto(minterA, half) + _treasuryInto(minterB, evt.planned - half);
        }
        emit EventFinalized(eventId, moved);
    }

    // -------------------------------------------------------------- internals

    /// @dev pool X corpus → tokens X → USD (redeem at X) → tokens Y minted at par
    ///      into pool Y rewards. Recomputed against live corpus: claims cannot
    ///      shrink the corpus (claims touch rewards only), but a prior finalized
    ///      slash can — hence min().
    function _slashInto(
        CommunityPool fromPool,
        PeaceMinter fromMinter,
        PeaceMinter toMinter,
        uint256 planned
    ) internal returns (uint256) {
        uint256 tokens = fromPool.slashCorpus(planned);
        if (tokens == 0) return 0;
        fromMinter.redeem(tokens);
        usd.forceApprove(address(toMinter), tokens);
        toMinter.mintAtPar(tokens);
        return tokens;
    }

    function _treasuryInto(PeaceMinter toMinter, uint256 planned) internal returns (uint256) {
        uint256 available = treasury.balance();
        uint256 amount = planned > available ? available : planned;
        if (amount == 0) return 0;
        treasury.release(address(this), amount);
        usd.forceApprove(address(toMinter), amount);
        toMinter.mintAtPar(amount);
        return amount;
    }

    // ------------------------------------------------------------------ views

    function isFinalized(uint256 eventId) external view returns (bool) {
        return events[eventId].status == EventStatus.Finalized;
    }

    function incentiveOf(uint256 eventId) external view returns (uint256) {
        return events[eventId].incentiveId;
    }
}

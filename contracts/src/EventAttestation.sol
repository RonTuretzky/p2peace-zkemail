// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EmailProof, SourceCategory} from "./Types.sol";
import {Guarded} from "./Guarded.sol";
import {IZKEmailVerifier} from "./interfaces/IZKEmailVerifier.sol";
import {IIncentiveRegistry} from "./interfaces/IIncentiveRegistry.sol";
import {IRedistributionEngine} from "./interfaces/IRedistributionEngine.sol";

/// @notice Permissionless oracle for real-world events, fed by newsletter zkEmail
///         proofs. Anyone holding a DKIM-signed email from one of an incentive's
///         approved sources, matching its committed keyword pattern, can attest.
///
///         Attestations cluster into *rounds* (one candidate event each): the first
///         proof opens the round; every proof's email timestamp must lie within the
///         incentive's attestation window of the first ("reports within 7 days of
///         the first report are the same event"). A round confirms when it has
///         distinct-domain coverage per source category, then hands off to the
///         RedistributionEngine for the dispute window.
contract EventAttestation is Ownable, Guarded {
    uint64 public constant SUBMISSION_LAG = 30 days; // email age limit at submission
    uint64 public constant FUTURE_SLACK = 1 hours; //  sender clock skew allowance

    enum RoundStatus {
        NoRound,
        Open,
        Confirmed,
        Failed
    }

    struct Round {
        uint64 firstTs; //  email timestamp anchoring the event span
        uint64 openedAt; // wall clock when the round opened
        uint16 countA;
        uint16 countB;
        uint16 countIntl;
        RoundStatus status;
    }

    IZKEmailVerifier public immutable verifier;
    IIncentiveRegistry public immutable incentives;
    IRedistributionEngine public engine;

    mapping(uint256 incentiveId => uint256) public currentRound;
    mapping(uint256 incentiveId => mapping(uint256 roundId => Round)) public rounds;
    /// @dev Per-round dedup. Domains: one slot per outlet per event. Nullifiers:
    ///      one count per physical email — but a *failed* round's emails may be
    ///      re-attested in a later round (an honest retry of the same real event);
    ///      cross-round refiring after a confirmation is throttled by the
    ///      incentive's cooldown, maxTriggers, and the 30-day submission lag.
    mapping(uint256 incentiveId => mapping(uint256 roundId => mapping(bytes32 => bool))) public
        domainUsed;
    mapping(uint256 incentiveId => mapping(uint256 roundId => mapping(bytes32 => bool))) public
        emailUsed;

    event EngineSet(address engine);
    event RoundOpened(uint256 indexed incentiveId, uint256 indexed roundId, uint64 firstTs);
    event Attested(
        uint256 indexed incentiveId,
        uint256 indexed roundId,
        bytes32 indexed domainHash,
        SourceCategory category,
        bytes32 nullifier
    );
    event RoundFailed(uint256 indexed incentiveId, uint256 indexed roundId);
    event RoundConfirmed(uint256 indexed incentiveId, uint256 indexed roundId, uint256 eventId);

    error EngineAlreadySet();
    error IncentiveNotActive();
    error CooldownActive();
    error InvalidProof();
    error PatternMismatch();
    error UnknownSource();
    error EmailTooOld();
    error EmailInFuture();
    error DomainAlreadyCounted();
    error EmailAlreadyCounted();
    error OutsideEventWindow();

    constructor(
        address owner_,
        address guardian_,
        IZKEmailVerifier verifier_,
        IIncentiveRegistry incentives_
    ) Ownable(owner_) Guarded(guardian_) {
        verifier = verifier_;
        incentives = incentives_;
    }

    function setEngine(IRedistributionEngine engine_) external onlyOwner {
        if (address(engine) != address(0)) revert EngineAlreadySet();
        engine = engine_;
        emit EngineSet(address(engine_));
    }

    function setGuardian(address guardian_) external onlyOwner {
        _setGuardian(guardian_);
    }

    function attest(uint256 incentiveId, EmailProof calldata p) external whenNotPaused {
        if (!incentives.isActive(incentiveId)) revert IncentiveNotActive();
        IIncentiveRegistry.IncentiveView memory inc = incentives.getIncentive(incentiveId);

        if (
            inc.lastTriggeredAt != 0
                && block.timestamp < uint256(inc.lastTriggeredAt) + inc.triggerCooldown
        ) revert CooldownActive();

        if (p.patternHash != inc.patternHash) revert PatternMismatch();
        SourceCategory cat = incentives.sourceCategory(incentiveId, p.domainHash);
        if (cat == SourceCategory.None) revert UnknownSource();
        if (block.timestamp > uint256(p.emailTimestamp) + SUBMISSION_LAG) revert EmailTooOld();
        if (p.emailTimestamp > block.timestamp + FUTURE_SLACK) revert EmailInFuture();
        if (!verifier.verify(p, 0)) revert InvalidProof();

        uint256 roundId = _resolveRound(incentiveId, p.emailTimestamp, inc.attestationWindow);
        Round storage round = rounds[incentiveId][roundId];

        if (domainUsed[incentiveId][roundId][p.domainHash]) revert DomainAlreadyCounted();
        if (emailUsed[incentiveId][roundId][p.nullifier]) revert EmailAlreadyCounted();
        domainUsed[incentiveId][roundId][p.domainHash] = true;
        emailUsed[incentiveId][roundId][p.nullifier] = true;

        if (cat == SourceCategory.CommunityA) round.countA += 1;
        else if (cat == SourceCategory.CommunityB) round.countB += 1;
        else round.countIntl += 1;

        emit Attested(incentiveId, roundId, p.domainHash, cat, p.nullifier);

        if (
            round.countA >= inc.requiredA && round.countB >= inc.requiredB
                && round.countIntl >= inc.requiredIntl
        ) {
            round.status = RoundStatus.Confirmed;
            incentives.onTriggered(incentiveId);
            uint256 eventId = engine.onEventConfirmed(incentiveId, roundId);
            emit RoundConfirmed(incentiveId, roundId, eventId);
        }
    }

    /// @dev Round policy: proofs join the current round while (a) the wall-clock
    ///      submission period (openedAt + window) is still open and (b) their email
    ///      timestamp lies within the event span (± window of the first email).
    ///      A proof arriving after the submission period lapses fails the old round
    ///      and opens a fresh one anchored on its own timestamp. A proof outside the
    ///      event span while the round is still live is rejected — it is evidence of
    ///      a *different* event and may be resubmitted once this round lapses.
    function _resolveRound(uint256 incentiveId, uint64 emailTs, uint32 window)
        internal
        returns (uint256 roundId)
    {
        roundId = currentRound[incentiveId];
        Round storage round = rounds[incentiveId][roundId];

        bool needNew;
        if (round.status != RoundStatus.Open) {
            needNew = true;
        } else if (block.timestamp > uint256(round.openedAt) + window) {
            round.status = RoundStatus.Failed;
            emit RoundFailed(incentiveId, roundId);
            needNew = true;
        } else {
            uint64 lo = round.firstTs > window ? round.firstTs - window : 0;
            if (emailTs < lo || emailTs > round.firstTs + window) revert OutsideEventWindow();
        }

        if (needNew) {
            roundId = ++currentRound[incentiveId];
            Round storage fresh = rounds[incentiveId][roundId];
            fresh.firstTs = emailTs;
            fresh.openedAt = uint64(block.timestamp);
            fresh.status = RoundStatus.Open;
            emit RoundOpened(incentiveId, roundId, emailTs);
        }
    }
}

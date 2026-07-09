// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BaseTest} from "./Base.t.sol";
import {Community, Direction, EmailProof, SourceCategory} from "../src/Types.sol";
import {EventAttestation} from "../src/EventAttestation.sol";
import {RedistributionEngine} from "../src/RedistributionEngine.sol";
import {Guarded} from "../src/Guarded.sol";
import {IIncentiveRegistry} from "../src/interfaces/IIncentiveRegistry.sol";
import {IRedistributionEngine} from "../src/interfaces/IRedistributionEngine.sol";

/// @notice Deep coverage of EventAttestation: activation gating, proof checks,
///         timestamp boundaries, pause behavior, round lifecycle (open / span /
///         wall-clock lapse / fail / re-attest), per-round dedup, category
///         thresholds, confirmation side effects, cooldown and maxTriggers.
contract AttestationTest is BaseTest {
    uint64 internal constant WINDOW = 7 days; //   defaultProposal attestationWindow
    uint64 internal constant COOLDOWN = 7 days; // defaultProposal triggerCooldown

    address internal alice = makeAddr("alice");
    address internal avi = makeAddr("avi");
    address internal basma = makeAddr("basma");
    address internal bilal = makeAddr("bilal");
    address internal rando = makeAddr("rando");

    uint256 internal incId;

    function setUp() public override {
        super.setUp();
        // Move well past the epoch so `now - 30 days - 1`-style timestamps exist.
        vm.warp(60 days);

        registerAndMint(alice, Community.A, "alice", 1000e18);
        registerAndMint(avi, Community.A, "avi", 1000e18);
        registerAndMint(basma, Community.B, "basma", 1000e18);
        registerAndMint(bilal, Community.B, "bilal", 1000e18);

        incId = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        passProposal(incId, _votersA(), _votersB());
        // now == 60 days + discussion (7d) + voting (3d) == 70 days
    }

    function _votersA() internal view returns (address[] memory v) {
        v = new address[](2);
        v[0] = alice;
        v[1] = avi;
    }

    function _votersB() internal view returns (address[] memory v) {
        v = new address[](2);
        v[0] = basma;
        v[1] = bilal;
    }

    /// @dev Attest against `incId` with a news proof for `domain`.
    function _attest(bytes32 domain, string memory seed, uint64 emailTs) internal {
        d.attestation.attest(incId, mkProof(domain, NEWS_PATTERN, emailNullifier(seed), emailTs));
    }

    function _round(uint256 id, uint256 roundId)
        internal
        view
        returns (
            uint64 firstTs,
            uint64 openedAt,
            uint16 countA,
            uint16 countB,
            uint16 countIntl,
            EventAttestation.RoundStatus status
        )
    {
        return d.attestation.rounds(id, roundId);
    }

    // =================================================== incentive activation gate

    function test_attest_reverts_unknownIncentive() public {
        vm.expectRevert(EventAttestation.IncentiveNotActive.selector);
        d.attestation.attest(
            999, mkProof(NEWS_A1, NEWS_PATTERN, emailNullifier("x"), uint64(block.timestamp))
        );
    }

    function test_attest_reverts_unfinalizedProposal() public {
        vm.prank(rando);
        uint256 id2 = d.incentives.propose(defaultProposal(Direction.HarmfulByB));
        assertFalse(d.incentives.isActive(id2));

        vm.expectRevert(EventAttestation.IncentiveNotActive.selector);
        d.attestation.attest(
            id2, mkProof(NEWS_A1, NEWS_PATTERN, emailNullifier("x"), uint64(block.timestamp))
        );
    }

    function test_attest_reverts_rejectedProposal() public {
        vm.prank(rando);
        uint256 id2 = d.incentives.propose(defaultProposal(Direction.HarmfulByB));
        // Nobody votes: fails dual majority and quorum.
        vm.warp(block.timestamp + d.incentives.discussionPeriod() + d.incentives.votingPeriod());
        d.incentives.finalize(id2);
        assertFalse(d.incentives.isActive(id2));

        vm.expectRevert(EventAttestation.IncentiveNotActive.selector);
        d.attestation.attest(
            id2, mkProof(NEWS_A1, NEWS_PATTERN, emailNullifier("x"), uint64(block.timestamp))
        );
    }

    // ============================================================== proof checks

    function test_attest_reverts_patternMismatch() public {
        vm.expectRevert(EventAttestation.PatternMismatch.selector);
        d.attestation.attest(
            incId,
            mkProof(NEWS_A1, CITIZENSHIP_PATTERN, emailNullifier("x"), uint64(block.timestamp))
        );
    }

    function test_attest_reverts_unknownSource() public {
        // GOV_A has a registered DKIM key but is not one of the incentive's sources.
        vm.expectRevert(EventAttestation.UnknownSource.selector);
        d.attestation.attest(
            incId, mkProof(GOV_A, NEWS_PATTERN, emailNullifier("x"), uint64(block.timestamp))
        );
    }

    function test_attest_emailTooOld_boundary() public {
        uint64 nowTs = uint64(block.timestamp);

        // One second beyond SUBMISSION_LAG: rejected.
        vm.expectRevert(EventAttestation.EmailTooOld.selector);
        _attest(NEWS_A1, "too-old", nowTs - 30 days - 1);

        // Exactly SUBMISSION_LAG old: accepted.
        _attest(NEWS_A1, "just-in-time", nowTs - 30 days);
        (uint64 firstTs,,,,,) = _round(incId, 1);
        assertEq(firstTs, nowTs - 30 days);
    }

    function test_attest_emailInFuture_boundary() public {
        uint64 nowTs = uint64(block.timestamp);

        // One second beyond FUTURE_SLACK: rejected.
        vm.expectRevert(EventAttestation.EmailInFuture.selector);
        _attest(NEWS_A1, "far-future", nowTs + 1 hours + 1);

        // Exactly FUTURE_SLACK ahead: accepted.
        _attest(NEWS_A1, "slight-skew", nowTs + 1 hours);
        (uint64 firstTs,,,,,) = _round(incId, 1);
        assertEq(firstTs, nowTs + 1 hours);
    }

    function test_attest_reverts_invalidProof_globalResult() public {
        d.groth16.setResult(false);
        vm.expectRevert(EventAttestation.InvalidProof.selector);
        _attest(NEWS_A1, "e", uint64(block.timestamp));

        // Restoring the verifier lets the exact same proof through.
        d.groth16.setResult(true);
        _attest(NEWS_A1, "e", uint64(block.timestamp));
        (,, uint16 countA,,,) = _round(incId, 1);
        assertEq(countA, 1);
    }

    function test_attest_reverts_invalidProof_vetoedInputs() public {
        uint64 ts = uint64(block.timestamp);
        EmailProof memory p = mkProof(NEWS_A1, NEWS_PATTERN, emailNullifier("vetoed"), ts);
        d.groth16.setVetoed(
            [
                uint256(p.dkimPubkeyHash),
                uint256(p.domainHash),
                uint256(p.nullifier),
                uint256(p.patternHash),
                uint256(p.emailTimestamp),
                0 // extraData is 0 for event attestations
            ],
            true
        );

        vm.expectRevert(EventAttestation.InvalidProof.selector);
        d.attestation.attest(incId, p);

        // Other proofs are unaffected.
        _attest(NEWS_B1, "fine", ts);
        (,,, uint16 countB,,) = _round(incId, 1);
        assertEq(countB, 1);
    }

    // ==================================================================== pause

    function test_pause_blocksAttest_andAutoExpires() public {
        vm.prank(guardian);
        d.attestation.pause(3 days);
        uint64 pausedUntil = d.attestation.pausedUntil();
        assertEq(pausedUntil, uint64(block.timestamp + 3 days));

        vm.expectRevert(Guarded.CurrentlyPaused.selector);
        _attest(NEWS_A1, "e", uint64(block.timestamp));

        // Last paused second.
        vm.warp(uint256(pausedUntil) - 1);
        vm.expectRevert(Guarded.CurrentlyPaused.selector);
        _attest(NEWS_A1, "e", uint64(block.timestamp));

        // Auto-expiry: exactly at pausedUntil the gate opens without any call.
        vm.warp(pausedUntil);
        _attest(NEWS_A1, "e", uint64(block.timestamp));
        (,, uint16 countA,,,) = _round(incId, 1);
        assertEq(countA, 1);
    }

    function test_unpause_reenablesImmediately() public {
        vm.prank(guardian);
        d.attestation.pause(10 days);
        vm.expectRevert(Guarded.CurrentlyPaused.selector);
        _attest(NEWS_A1, "e", uint64(block.timestamp));

        vm.prank(guardian);
        d.attestation.unpause();
        assertEq(d.attestation.pausedUntil(), 0);
        _attest(NEWS_A1, "e", uint64(block.timestamp));
    }

    function test_pause_maxDurationBoundary() public {
        uint256 maxPause = d.attestation.MAX_PAUSE();
        assertEq(maxPause, 14 days);

        vm.prank(guardian);
        vm.expectRevert(Guarded.PauseTooLong.selector);
        d.attestation.pause(maxPause + 1);

        vm.prank(guardian);
        d.attestation.pause(maxPause);
        assertEq(d.attestation.pausedUntil(), uint64(block.timestamp + maxPause));
    }

    function test_pause_onlyGuardian() public {
        // Not even the owner (this test contract) may pause or unpause.
        vm.expectRevert(Guarded.NotGuardian.selector);
        d.attestation.pause(1 days);

        vm.prank(rando);
        vm.expectRevert(Guarded.NotGuardian.selector);
        d.attestation.pause(1 days);

        vm.prank(rando);
        vm.expectRevert(Guarded.NotGuardian.selector);
        d.attestation.unpause();
    }

    // ==================================================================== rounds

    function test_firstAttest_opensRound_anchorsFirstTs() public {
        uint64 emailTs = uint64(block.timestamp - 5 hours);
        assertEq(d.attestation.currentRound(incId), 0);

        vm.expectEmit(true, true, false, true, address(d.attestation));
        emit EventAttestation.RoundOpened(incId, 1, emailTs);
        vm.expectEmit(true, true, true, true, address(d.attestation));
        emit EventAttestation.Attested(
            incId, 1, NEWS_A1, SourceCategory.CommunityA, emailNullifier("first")
        );
        _attest(NEWS_A1, "first", emailTs);

        assertEq(d.attestation.currentRound(incId), 1);
        (uint64 firstTs, uint64 openedAt, uint16 cA, uint16 cB, uint16 cI,
            EventAttestation.RoundStatus status) = _round(incId, 1);
        assertEq(firstTs, emailTs, "anchored on email ts, not wall clock");
        assertEq(openedAt, uint64(block.timestamp));
        assertEq(cA, 1);
        assertEq(cB, 0);
        assertEq(cI, 0);
        assertEq(uint8(status), uint8(EventAttestation.RoundStatus.Open));
    }

    function test_eventSpan_plusMinusWindow_boundaries() public {
        uint64 nowTs = uint64(block.timestamp);
        uint64 firstTs = nowTs - WINDOW;
        _attest(NEWS_A1, "anchor", firstTs);

        // Exactly firstTs + window: accepted.
        _attest(NEWS_B1, "hi-edge", firstTs + WINDOW);
        // Exactly firstTs - window: accepted.
        _attest(NEWS_I1, "lo-edge", firstTs - WINDOW);

        // One past either edge while the round is live: OutsideEventWindow.
        vm.expectRevert(EventAttestation.OutsideEventWindow.selector);
        _attest(NEWS_I2, "hi-out", firstTs + WINDOW + 1);
        vm.expectRevert(EventAttestation.OutsideEventWindow.selector);
        _attest(NEWS_I2, "lo-out", firstTs - WINDOW - 1);

        (,, uint16 cA, uint16 cB, uint16 cI, EventAttestation.RoundStatus status) =
            _round(incId, 1);
        assertEq(cA, 1);
        assertEq(cB, 1);
        assertEq(cI, 1);
        assertEq(uint8(status), uint8(EventAttestation.RoundStatus.Open), "1 intl < required 2");
        assertEq(d.attestation.currentRound(incId), 1, "rejects did not spawn rounds");
    }

    function test_wallClock_exactlyAtLapse_stillJoinsRound() public {
        uint64 firstTs = uint64(block.timestamp);
        _attest(NEWS_A1, "anchor", firstTs);
        (, uint64 openedAt,,,,) = _round(incId, 1);

        // block.timestamp == openedAt + window is NOT past the submission period.
        vm.warp(uint256(openedAt) + WINDOW);
        _attest(NEWS_B1, "late-but-ok", firstTs);
        assertEq(d.attestation.currentRound(incId), 1);
        (,,, uint16 cB,,) = _round(incId, 1);
        assertEq(cB, 1);
    }

    function test_wallClockLapse_failsOldRound_opensNew() public {
        uint64 firstTs = uint64(block.timestamp);
        _attest(NEWS_A1, "anchor", firstTs);
        (, uint64 openedAt,,,,) = _round(incId, 1);

        vm.warp(uint256(openedAt) + WINDOW + 1);
        uint64 newTs = uint64(block.timestamp);

        vm.expectEmit(true, true, false, true, address(d.attestation));
        emit EventAttestation.RoundFailed(incId, 1);
        vm.expectEmit(true, true, false, true, address(d.attestation));
        emit EventAttestation.RoundOpened(incId, 2, newTs);
        _attest(NEWS_B1, "reopener", newTs);

        assertEq(d.attestation.currentRound(incId), 2);
        (,,,,, EventAttestation.RoundStatus s1) = _round(incId, 1);
        assertEq(uint8(s1), uint8(EventAttestation.RoundStatus.Failed));
        (uint64 f2, uint64 o2, uint16 a2, uint16 b2,, EventAttestation.RoundStatus s2) =
            _round(incId, 2);
        assertEq(f2, newTs, "new round anchored on its own email ts");
        assertEq(o2, newTs);
        assertEq(a2, 0);
        assertEq(b2, 1);
        assertEq(uint8(s2), uint8(EventAttestation.RoundStatus.Open));
    }

    function test_failedRoundEmails_canReattest_inNewRound() public {
        uint64 firstTs = uint64(block.timestamp);
        EmailProof memory p = mkProof(NEWS_A1, NEWS_PATTERN, emailNullifier("retry"), firstTs);
        d.attestation.attest(incId, p);

        // Round lapses without confirming.
        vm.warp(block.timestamp + WINDOW + 1);

        // The exact same email (same nullifier, same domain, same ts) re-attests:
        // nullifier and domain dedup are scoped per round.
        d.attestation.attest(incId, p);
        assertEq(d.attestation.currentRound(incId), 2);
        assertTrue(d.attestation.emailUsed(incId, 1, p.nullifier));
        assertTrue(d.attestation.emailUsed(incId, 2, p.nullifier));
        (uint64 f2,, uint16 a2,,,) = _round(incId, 2);
        assertEq(f2, firstTs);
        assertEq(a2, 1);
    }

    // ==================================================================== dedup

    function test_dedup_domainOncePerRound() public {
        uint64 ts = uint64(block.timestamp);
        _attest(NEWS_A1, "n1", ts);

        // Same outlet, different physical email: still one slot per domain.
        vm.expectRevert(EventAttestation.DomainAlreadyCounted.selector);
        _attest(NEWS_A1, "n2", ts);
    }

    function test_dedup_emailNullifierOncePerRound() public {
        uint64 ts = uint64(block.timestamp);
        _attest(NEWS_A1, "same-email", ts);

        // Same email replayed under another approved domain: nullifier catches it.
        vm.expectRevert(EventAttestation.EmailAlreadyCounted.selector);
        _attest(NEWS_A2, "same-email", ts);
    }

    function test_categoryCounts_fillCorrectly() public {
        uint64 ts = uint64(block.timestamp);
        _attest(NEWS_A1, "a1", ts);
        _attest(NEWS_A2, "a2", ts);
        _attest(NEWS_B1, "b1", ts);
        _attest(NEWS_I1, "i1", ts);

        (,, uint16 cA, uint16 cB, uint16 cI, EventAttestation.RoundStatus status) =
            _round(incId, 1);
        assertEq(cA, 2);
        assertEq(cB, 1);
        assertEq(cI, 1);
        assertEq(uint8(status), uint8(EventAttestation.RoundStatus.Open), "intl 1 < required 2");
        assertEq(d.incentives.getIncentive(incId).triggerCount, 0);
    }

    function test_bCategoryDomain_neverSatisfiesRequiredA() public {
        uint64 ts = uint64(block.timestamp);
        // Saturate B and International; leave A empty.
        _attest(NEWS_B1, "b1", ts);
        _attest(NEWS_B2, "b2", ts);
        _attest(NEWS_I1, "i1", ts);
        _attest(NEWS_I2, "i2", ts);
        _attest(NEWS_I3, "i3", ts);

        (,, uint16 cA, uint16 cB, uint16 cI, EventAttestation.RoundStatus status) =
            _round(incId, 1);
        assertEq(cA, 0, "B/Intl attestations never leak into the A count");
        assertEq(cB, 2);
        assertEq(cI, 3);
        assertEq(uint8(status), uint8(EventAttestation.RoundStatus.Open));
        assertEq(d.incentives.getIncentive(incId).triggerCount, 0);
        assertEq(d.engine.eventCount(), 0);
    }

    // ============================================================== confirmation

    function test_confirms_exactlyAtThresholds_withSideEffects() public {
        uint64 ts = uint64(block.timestamp);
        _attest(NEWS_A1, "a1", ts); // A: 1/1
        _attest(NEWS_B1, "b1", ts); // B: 1/1
        _attest(NEWS_I1, "i1", ts); // Intl: 1/2 - one short
        (,,,,, EventAttestation.RoundStatus preStatus) = _round(incId, 1);
        assertEq(uint8(preStatus), uint8(EventAttestation.RoundStatus.Open));

        // The 4th proof crosses the last threshold exactly.
        vm.expectEmit(true, true, false, true, address(d.attestation));
        emit EventAttestation.RoundConfirmed(incId, 1, 1);
        _attest(NEWS_I2, "i2", ts);

        (,,,,, EventAttestation.RoundStatus status) = _round(incId, 1);
        assertEq(uint8(status), uint8(EventAttestation.RoundStatus.Confirmed));

        // Trigger bookkeeping bumped on the incentive.
        IIncentiveRegistry.IncentiveView memory inc = d.incentives.getIncentive(incId);
        assertEq(inc.triggerCount, 1);
        assertEq(inc.lastTriggeredAt, uint64(block.timestamp));

        // Engine holds the pending event with the snapshotted planned amount:
        // 5% of the 200e18 pool-A corpus (2 members x 1000e18 x 10%).
        assertEq(d.engine.eventCount(), 1);
        (uint256 evtIncentive, uint256 evtRound, Direction dir, uint256 planned,
            uint64 confirmedAt, RedistributionEngine.EventStatus evtStatus) = d.engine.events(1);
        assertEq(evtIncentive, incId);
        assertEq(evtRound, 1);
        assertEq(uint8(dir), uint8(Direction.HarmfulByA));
        assertEq(planned, 10e18);
        assertEq(confirmedAt, uint64(block.timestamp));
        assertEq(uint8(evtStatus), uint8(RedistributionEngine.EventStatus.Pending));
    }

    function test_cooldown_afterConfirmation_boundary() public {
        uint64 ts = uint64(block.timestamp);
        confirmDefaultEvent(incId, ts, "ev1");
        uint64 triggeredAt = d.incentives.getIncentive(incId).lastTriggeredAt;
        assertEq(triggeredAt, uint64(block.timestamp));

        // Immediately after confirmation: throttled.
        vm.expectRevert(EventAttestation.CooldownActive.selector);
        _attest(NEWS_A1, "ev2-early", ts);

        // Last throttled second.
        vm.warp(uint256(triggeredAt) + COOLDOWN - 1);
        vm.expectRevert(EventAttestation.CooldownActive.selector);
        _attest(NEWS_A1, "ev2-almost", uint64(block.timestamp));

        // Exactly at lastTriggeredAt + cooldown: allowed, and since round 1 is
        // Confirmed the proof opens a brand-new round.
        vm.warp(uint256(triggeredAt) + COOLDOWN);
        uint64 ts2 = uint64(block.timestamp);
        vm.expectEmit(true, true, false, true, address(d.attestation));
        emit EventAttestation.RoundOpened(incId, 2, ts2);
        _attest(NEWS_A1, "ev2", ts2);
        assertEq(d.attestation.currentRound(incId), 2);
    }

    function test_retriggers_untilMaxTriggers_thenInactive() public {
        // Trigger 1.
        confirmDefaultEvent(incId, uint64(block.timestamp), "ev1");
        assertEq(d.incentives.getIncentive(incId).triggerCount, 1);
        assertTrue(d.incentives.isActive(incId));

        // Trigger 2, after the cooldown.
        vm.warp(block.timestamp + COOLDOWN);
        confirmDefaultEvent(incId, uint64(block.timestamp), "ev2");
        IIncentiveRegistry.IncentiveView memory inc = d.incentives.getIncentive(incId);
        assertEq(inc.triggerCount, 2);
        assertEq(inc.lastTriggeredAt, uint64(block.timestamp));
        assertTrue(d.incentives.isActive(incId));

        // Trigger 3 == maxTriggers: incentive retires.
        vm.warp(block.timestamp + COOLDOWN);
        confirmDefaultEvent(incId, uint64(block.timestamp), "ev3");
        assertEq(d.incentives.getIncentive(incId).triggerCount, 3);
        assertFalse(d.incentives.isActive(incId));

        // Three pending events, one per round.
        assertEq(d.engine.eventCount(), 3);
        (, uint256 r2,,,,) = d.engine.events(2);
        (, uint256 r3,,,,) = d.engine.events(3);
        assertEq(r2, 2);
        assertEq(r3, 3);

        // Exhausted: even after the cooldown, attestation is dead.
        vm.warp(block.timestamp + COOLDOWN);
        vm.expectRevert(EventAttestation.IncentiveNotActive.selector);
        _attest(NEWS_A1, "ev4", uint64(block.timestamp));
    }

    // ==================================================================== wiring

    function test_setEngine_onlyOnce() public {
        // Deploy already wired the engine.
        assertEq(address(d.attestation.engine()), address(d.engine));
        vm.expectRevert(EventAttestation.EngineAlreadySet.selector);
        d.attestation.setEngine(IRedistributionEngine(address(0xBEEF)));
    }

    function test_setEngine_onlyOwner() public {
        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, rando));
        d.attestation.setEngine(IRedistributionEngine(address(0xBEEF)));
    }

    function test_setGuardian_onlyOwner() public {
        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, rando));
        d.attestation.setGuardian(rando);

        // Owner (this test contract) rotates the guardian; old guardian loses pause.
        d.attestation.setGuardian(rando);
        assertEq(d.attestation.guardian(), rando);
        vm.prank(guardian);
        vm.expectRevert(Guarded.NotGuardian.selector);
        d.attestation.pause(1 days);
        vm.prank(rando);
        d.attestation.pause(1 days);
        assertEq(d.attestation.pausedUntil(), uint64(block.timestamp + 1 days));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BaseTest} from "./Base.t.sol";
import {Community, Direction} from "../src/Types.sol";
import {IncentiveRegistry} from "../src/IncentiveRegistry.sol";
import {RedistributionEngine} from "../src/RedistributionEngine.sol";
import {DisputeCouncil} from "../src/DisputeCouncil.sol";
import {Guarded} from "../src/Guarded.sol";

/// @notice Deep coverage of RedistributionEngine (confirmation planning, dispute
///         window boundaries, finalize value routes + capping, reversal, pause)
///         and DisputeCouncil (membership bookkeeping, 75% threshold math).
contract EngineTest is BaseTest {
    // mirror declarations so vm.expectEmit can reference them
    event EventFinalized(uint256 indexed eventId, uint256 moved);
    event EventReversed(uint256 indexed eventId);
    event Reversed(uint256 indexed eventId);

    address internal alice = makeAddr("alice");
    address internal avi = makeAddr("avi");
    address internal basma = makeAddr("basma");
    address internal bilal = makeAddr("bilal");

    // ---------------------------------------------------------------- helpers

    /// @dev Two members per community, 1000 mUSD each: corpusA = corpusB = 200e18,
    ///      tokenA/B supply 2000e18, both minter reserves 2000e18.
    function _enroll() internal {
        registerAndMint(alice, Community.A, "alice", 1000e18);
        registerAndMint(avi, Community.A, "avi", 1000e18);
        registerAndMint(basma, Community.B, "basma", 1000e18);
        registerAndMint(bilal, Community.B, "bilal", 1000e18);
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

    function _passDefault(Direction dir) internal returns (uint256 id) {
        id = d.incentives.propose(defaultProposal(dir));
        passProposal(id, _votersA(), _votersB());
    }

    /// @dev Confirm one default event (1 A + 1 B + 2 intl sources, emails 1h old).
    function _confirm(uint256 incentiveId, string memory seed)
        internal
        returns (uint256 eventId)
    {
        confirmDefaultEvent(incentiveId, uint64(block.timestamp - 1 hours), seed);
        eventId = d.engine.eventCount();
    }

    function _fundTreasury(uint256 amount) internal {
        d.usd.mint(address(this), amount);
        d.usd.approve(address(d.treasury), amount);
        d.treasury.donate(amount);
    }

    function _evt(uint256 id)
        internal
        view
        returns (RedistributionEngine.PendingEvent memory e)
    {
        (e.incentiveId, e.roundId, e.direction, e.planned, e.confirmedAt, e.status) =
            d.engine.events(id);
    }

    function _assertReserves() internal view {
        assertEq(
            d.usd.balanceOf(address(d.minterA)), d.tokenA.totalSupply(), "A reserve = A supply"
        );
        assertEq(
            d.usd.balanceOf(address(d.minterB)), d.tokenB.totalSupply(), "B reserve = B supply"
        );
    }

    /// @dev Propose + pass `n` HarmfulByA incentives with `bps` redistribution, all
    ///      sharing one discussion/voting window. Returns incentive ids in order.
    function _passManyHarmfulA(uint256 n, uint16 bps) internal returns (uint256[] memory ids) {
        ids = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByA);
            input.redistributionBps = bps;
            ids[i] = d.incentives.propose(input);
        }
        vm.warp(block.timestamp + d.incentives.discussionPeriod());
        address[4] memory voters = [alice, avi, basma, bilal];
        for (uint256 v = 0; v < voters.length; v++) {
            vm.startPrank(voters[v]);
            (v < 2 ? d.tokenA : d.tokenB).approve(address(d.incentives), type(uint256).max);
            for (uint256 i = 0; i < n; i++) {
                d.incentives.castVote(ids[i], true, 1);
            }
            vm.stopPrank();
        }
        vm.warp(block.timestamp + d.incentives.votingPeriod());
        for (uint256 i = 0; i < n; i++) {
            d.incentives.finalize(ids[i]);
            require(d.incentives.isActive(ids[i]), "proposal did not pass");
        }
    }

    // ---------------------------------------------------- onEventConfirmed gate

    function test_onEventConfirmed_onlyAttestation() public {
        vm.expectRevert(RedistributionEngine.NotAttestation.selector);
        d.engine.onEventConfirmed(1, 1);

        vm.prank(guardian);
        vm.expectRevert(RedistributionEngine.NotAttestation.selector);
        d.engine.onEventConfirmed(1, 1);
    }

    // ------------------------------------------------------- planned amounts

    function test_confirm_harmfulByA_plansFivePercentOfPoolACorpus() public {
        _enroll();
        // fund the treasury too - Harmful planning must ignore it
        _fundTreasury(1_000e18);
        uint256 id = _passDefault(Direction.HarmfulByA);
        uint256 evt = _confirm(id, "hA");

        RedistributionEngine.PendingEvent memory e = _evt(evt);
        assertEq(evt, 1, "first event id");
        assertEq(d.engine.eventCount(), 1);
        assertEq(e.incentiveId, id);
        assertEq(e.roundId, 1, "first round of the incentive");
        assertEq(uint8(e.direction), uint8(Direction.HarmfulByA));
        assertEq(e.planned, 10e18, "5% of 200e18 corpus A");
        assertEq(e.confirmedAt, uint64(block.timestamp));
        assertEq(uint8(e.status), uint8(RedistributionEngine.EventStatus.Pending));
        assertEq(d.engine.incentiveOf(evt), id);
        assertFalse(d.engine.isFinalized(evt));
    }

    function test_confirm_harmfulByB_plansFivePercentOfPoolBCorpus() public {
        // asymmetric corpora: A stakes 200e18, B stakes 260e18
        registerAndMint(alice, Community.A, "alice", 1000e18);
        registerAndMint(avi, Community.A, "avi", 1000e18);
        registerAndMint(basma, Community.B, "basma", 1000e18);
        registerAndMint(bilal, Community.B, "bilal", 1600e18);
        assertEq(d.poolB.corpusBalance(), 260e18);

        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByB));
        passProposal(id, _votersA(), _votersB());
        uint256 evt = _confirm(id, "hB");
        assertEq(_evt(evt).planned, 13e18, "5% of 260e18 corpus B");
    }

    function test_confirm_positive_plansFivePercentOfTreasury() public {
        _enroll();
        _fundTreasury(100e18); // corpus is 200e18; treasury 100e18 - must use treasury
        uint256 id = _passDefault(Direction.PositiveForA);
        uint256 evt = _confirm(id, "pA");
        assertEq(_evt(evt).planned, 5e18, "5% of 100e18 treasury, not corpus");
    }

    function test_confirm_joint_plansFivePercentOfTreasury() public {
        _enroll();
        _fundTreasury(400e18);
        uint256 id = _passDefault(Direction.Joint);
        uint256 evt = _confirm(id, "jt");
        assertEq(_evt(evt).planned, 20e18, "5% of 400e18 treasury");
    }

    function test_confirm_treasuryFundedByOutsiderPremium() public {
        _enroll();
        // outsider pays 2x: 100e18 in -> 50e18 tokens, 50e18 premium to treasury
        address olga = makeAddr("olga");
        d.usd.mint(olga, 100e18);
        vm.startPrank(olga);
        d.usd.approve(address(d.minterA), 100e18);
        d.minterA.mintOutsider(100e18);
        vm.stopPrank();
        assertEq(d.treasury.balance(), 50e18, "premium half funds treasury");
        _assertReserves();

        uint256 id = _passDefault(Direction.PositiveForB);
        uint256 evt = _confirm(id, "pB");
        assertEq(_evt(evt).planned, 2.5e18, "5% of premium-funded treasury");
    }

    // ------------------------------------------------------- finalize: timing

    function test_finalize_windowBoundary_exact48h() public {
        _enroll();
        uint256 id = _passDefault(Direction.HarmfulByA);
        uint256 evt = _confirm(id, "t");
        uint256 confirmedAt = _evt(evt).confirmedAt;

        vm.warp(confirmedAt + 48 hours - 1);
        vm.expectRevert(RedistributionEngine.DisputeWindowOpen.selector);
        d.engine.finalize(evt);

        // exactly at the boundary the window is over; anyone may finalize
        vm.warp(confirmedAt + 48 hours);
        vm.prank(makeAddr("anyone"));
        d.engine.finalize(evt);
        assertTrue(d.engine.isFinalized(evt));
    }

    function test_finalize_unknownEvent() public {
        vm.expectRevert(RedistributionEngine.UnknownEvent.selector);
        d.engine.finalize(0);
        vm.expectRevert(RedistributionEngine.UnknownEvent.selector);
        d.engine.finalize(999);
    }

    function test_finalize_executesExactlyOnce() public {
        _enroll();
        uint256 id = _passDefault(Direction.HarmfulByA);
        uint256 evt = _confirm(id, "once");
        vm.warp(block.timestamp + 48 hours);
        d.engine.finalize(evt);

        uint256 corpusAfter = d.poolA.corpusBalance();
        vm.expectRevert(RedistributionEngine.NotPending.selector);
        d.engine.finalize(evt);
        assertEq(d.poolA.corpusBalance(), corpusAfter, "no double slash");
    }

    // -------------------------------------------------- finalize: harmful flow

    function test_finalize_harmfulByA_fullAccounting() public {
        _enroll();
        uint256 id = _passDefault(Direction.HarmfulByA);
        uint256 evt = _confirm(id, "acct");
        vm.warp(block.timestamp + 48 hours);

        vm.expectEmit(true, false, false, true, address(d.engine));
        emit EventFinalized(evt, 10e18);
        d.engine.finalize(evt);

        // A side: corpus slashed, tokens redeemed (burned), reserve follows
        assertEq(d.poolA.corpusBalance(), 190e18, "corpus down 10");
        assertEq(d.tokenA.balanceOf(address(d.poolA)), 190e18, "pool A holds only corpus");
        assertEq(d.tokenA.totalSupply(), 1990e18, "10 tokens A redeemed/burned");
        // B side: 10 tokens minted at par into pool B *rewards* (corpus untouched)
        assertEq(d.tokenB.totalSupply(), 2010e18, "10 tokens B minted");
        assertEq(d.tokenB.balanceOf(address(d.poolB)), 210e18, "200 corpus + 10 rewards");
        assertEq(d.poolB.corpusBalance(), 200e18, "B corpus untouched");
        // equal split of rewards among the 2 B members; A members get nothing
        assertEq(d.poolB.claimable(basma), 5e18);
        assertEq(d.poolB.claimable(bilal), 5e18);
        assertEq(d.poolA.claimable(alice), 0);
        // engine keeps nothing; treasury untouched
        assertEq(d.usd.balanceOf(address(d.engine)), 0);
        assertEq(d.tokenA.balanceOf(address(d.engine)), 0);
        assertEq(d.treasury.balance(), 0);
        // reserve invariant on BOTH minters
        _assertReserves();
        assertEq(uint8(_evt(evt).status), uint8(RedistributionEngine.EventStatus.Finalized));
    }

    function test_finalize_harmfulByB_mirror() public {
        _enroll();
        uint256 id = _passDefault(Direction.HarmfulByB);
        uint256 evt = _confirm(id, "mirror");
        vm.warp(block.timestamp + 48 hours);
        d.engine.finalize(evt);

        assertEq(d.poolB.corpusBalance(), 190e18);
        assertEq(d.tokenB.totalSupply(), 1990e18);
        assertEq(d.tokenA.totalSupply(), 2010e18);
        assertEq(d.poolA.claimable(alice), 5e18);
        assertEq(d.poolA.claimable(avi), 5e18);
        _assertReserves();
    }

    /// @dev planned is recomputed against the live corpus via min(): with seven
    ///      overlapping pending events each planning 20% of the same 200e18 corpus,
    ///      the first five drain it exactly; the sixth moves only what a fresh mint
    ///      restaked (partial cap) and the seventh moves nothing (full cap) - both
    ///      finalize cleanly, never reverting.
    function test_finalize_harmful_cappedByLiveCorpus() public {
        _enroll();
        d.incentives.setParams(7 days, 3 days, 3_000, 2_000); // raise bps ceiling
        uint256[] memory ids = _passManyHarmfulA(7, 2_000);

        // corpus stays 200e18 across all confirmations -> each plans 40e18
        uint256[] memory evts = new uint256[](7);
        for (uint256 i = 0; i < 7; i++) {
            evts[i] = _confirm(ids[i], string.concat("cap", vm.toString(i)));
            assertEq(_evt(evts[i]).planned, 40e18, "each plans 20% of 200e18");
        }
        assertEq(d.poolA.corpusBalance(), 200e18, "planning moved nothing");

        vm.warp(block.timestamp + 48 hours);
        for (uint256 i = 0; i < 5; i++) {
            vm.expectEmit(true, false, false, true, address(d.engine));
            emit EventFinalized(evts[i], 40e18);
            d.engine.finalize(evts[i]);
        }
        assertEq(d.poolA.corpusBalance(), 0, "5 x 40 drained the corpus");

        // a fresh citizen mint restakes 3e18 of corpus before event 6 finalizes
        d.usd.mint(avi, 30e18);
        vm.startPrank(avi);
        d.usd.approve(address(d.minterA), 30e18);
        d.minterA.mintCitizen(30e18);
        vm.stopPrank();
        assertEq(d.poolA.corpusBalance(), 3e18);

        // event 6: planned 40e18 but only 3e18 corpus left -> moves 3e18
        vm.expectEmit(true, false, false, true, address(d.engine));
        emit EventFinalized(evts[5], 3e18);
        d.engine.finalize(evts[5]);
        assertEq(d.poolA.corpusBalance(), 0);

        // event 7: corpus empty -> moves 0, still finalizes exactly once
        uint256 supplyB = d.tokenB.totalSupply();
        vm.expectEmit(true, false, false, true, address(d.engine));
        emit EventFinalized(evts[6], 0);
        d.engine.finalize(evts[6]);
        assertTrue(d.engine.isFinalized(evts[6]));
        assertEq(d.tokenB.totalSupply(), supplyB, "zero-move mints nothing");

        // 203e18 total crossed sides; every token still backed 1:1
        assertEq(d.tokenB.balanceOf(address(d.poolB)), 403e18, "200 corpus + 203 rewards");
        assertEq(d.poolB.claimable(basma), 101.5e18);
        _assertReserves();
    }

    // ------------------------------------------------- finalize: positive/joint

    function test_finalize_positiveForA_paysFromTreasury() public {
        _enroll();
        _fundTreasury(100e18);
        uint256 id = _passDefault(Direction.PositiveForA);
        uint256 evt = _confirm(id, "posA");
        vm.warp(block.timestamp + 48 hours);

        vm.expectEmit(true, false, false, true, address(d.engine));
        emit EventFinalized(evt, 5e18);
        d.engine.finalize(evt);

        assertEq(d.treasury.balance(), 95e18, "treasury down by planned");
        assertEq(d.tokenA.totalSupply(), 2005e18, "5 tokens A minted at par");
        assertEq(d.tokenA.balanceOf(address(d.poolA)), 205e18, "into pool A rewards");
        assertEq(d.poolA.corpusBalance(), 200e18, "corpus untouched");
        assertEq(d.poolA.claimable(alice), 2.5e18);
        assertEq(d.poolA.claimable(avi), 2.5e18);
        assertEq(d.poolB.claimable(basma), 0);
        _assertReserves();
    }

    function test_finalize_positiveForB_cappedByDrainedTreasury() public {
        _enroll();
        _fundTreasury(100e18);
        uint256 id = _passDefault(Direction.PositiveForB);
        uint256 evt = _confirm(id, "posB");
        assertEq(_evt(evt).planned, 5e18);

        // owner drains the treasury down to 2e18 during the dispute window
        d.treasury.setSpender(address(this), true);
        d.treasury.release(address(this), 98e18);

        vm.warp(block.timestamp + 48 hours);
        vm.expectEmit(true, false, false, true, address(d.engine));
        emit EventFinalized(evt, 2e18); // moved < planned
        d.engine.finalize(evt);

        assertEq(d.treasury.balance(), 0);
        assertEq(d.tokenB.balanceOf(address(d.poolB)), 202e18);
        assertEq(d.poolB.claimable(basma), 1e18);
        _assertReserves();
    }

    function test_finalize_positive_emptyTreasuryMovesZero() public {
        _enroll();
        _fundTreasury(100e18);
        uint256 id = _passDefault(Direction.PositiveForA);
        uint256 evt = _confirm(id, "posZero");
        d.treasury.setSpender(address(this), true);
        d.treasury.release(address(this), 100e18);

        vm.warp(block.timestamp + 48 hours);
        vm.expectEmit(true, false, false, true, address(d.engine));
        emit EventFinalized(evt, 0);
        d.engine.finalize(evt);
        assertTrue(d.engine.isFinalized(evt));
        assertEq(d.tokenA.totalSupply(), 2000e18, "nothing minted");
        _assertReserves();
    }

    function test_finalize_joint_splitsHalfHalf_oddWei() public {
        _enroll();
        _fundTreasury(100e18 + 30); // planned = (100e18+30)/20 = 5e18 + 1 (odd)
        uint256 id = _passDefault(Direction.Joint);
        uint256 evt = _confirm(id, "joint");
        uint256 planned = _evt(evt).planned;
        assertEq(planned, 5e18 + 1);

        vm.warp(block.timestamp + 48 hours);
        vm.expectEmit(true, false, false, true, address(d.engine));
        emit EventFinalized(evt, planned); // moved = half + (planned - half)
        d.engine.finalize(evt);

        // A gets floor(planned/2); B gets the extra wei
        assertEq(d.tokenA.balanceOf(address(d.poolA)), 200e18 + 2.5e18, "A half");
        assertEq(d.tokenB.balanceOf(address(d.poolB)), 200e18 + 2.5e18 + 1, "B half + 1 wei");
        assertEq(d.treasury.balance(), 100e18 + 30 - planned);
        assertEq(d.poolA.corpusBalance(), 200e18);
        assertEq(d.poolB.corpusBalance(), 200e18);
        _assertReserves();
    }

    // --------------------------------------------------------- finalize: pause

    function test_finalize_pause_blocksThenSelfHeals() public {
        _enroll();
        uint256 id = _passDefault(Direction.HarmfulByA);
        uint256 evt = _confirm(id, "pause");
        uint256 t0 = block.timestamp;

        vm.prank(guardian);
        d.engine.pause(3 days); // pausedUntil = t0 + 3 days

        // window has passed but the engine is paused
        vm.warp(t0 + 48 hours);
        vm.expectRevert(Guarded.CurrentlyPaused.selector);
        d.engine.finalize(evt);

        // Documented behavior: the dispute window keeps running during a pause.
        // At 48h the council can no longer reverse even though finalize is blocked
        // - a pause does NOT extend the window, only delays execution.
        vm.prank(address(d.council));
        vm.expectRevert(RedistributionEngine.DisputeWindowClosed.selector);
        d.engine.reverse(evt);

        vm.warp(t0 + 3 days - 1);
        vm.expectRevert(Guarded.CurrentlyPaused.selector);
        d.engine.finalize(evt);

        // pause self-heals at exactly pausedUntil
        vm.warp(t0 + 3 days);
        d.engine.finalize(evt);
        assertTrue(d.engine.isFinalized(evt));
        _assertReserves();
    }

    function test_finalize_guardianUnpauseUnblocks() public {
        _enroll();
        uint256 id = _passDefault(Direction.HarmfulByA);
        uint256 evt = _confirm(id, "unpause");

        // only the guardian may pause
        vm.expectRevert(Guarded.NotGuardian.selector);
        d.engine.pause(1 days);

        vm.prank(guardian);
        d.engine.pause(14 days);
        vm.warp(block.timestamp + 48 hours);
        vm.expectRevert(Guarded.CurrentlyPaused.selector);
        d.engine.finalize(evt);

        vm.prank(guardian);
        d.engine.unpause();
        d.engine.finalize(evt);
        assertTrue(d.engine.isFinalized(evt));
    }

    // ----------------------------------------------------------- engine.reverse

    function test_reverse_onlyCouncil() public {
        _enroll();
        uint256 id = _passDefault(Direction.HarmfulByA);
        uint256 evt = _confirm(id, "rc");

        vm.expectRevert(RedistributionEngine.NotCouncil.selector);
        d.engine.reverse(evt);
        vm.prank(guardian);
        vm.expectRevert(RedistributionEngine.NotCouncil.selector);
        d.engine.reverse(evt);
    }

    function test_reverse_insideWindow_restoresTriggerSlot() public {
        _enroll();
        IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByA);
        input.maxTriggers = 1;
        uint256 id = d.incentives.propose(input);
        passProposal(id, _votersA(), _votersB());
        uint256 evt = _confirm(id, "slot");

        // trigger slot consumed: single-trigger incentive is no longer active
        assertEq(d.incentives.getIncentive(id).triggerCount, 1);
        assertFalse(d.incentives.isActive(id));

        // reverse just before the window closes
        vm.warp(_evt(evt).confirmedAt + 48 hours - 1);
        vm.expectEmit(true, false, false, true, address(d.engine));
        emit EventReversed(evt);
        vm.prank(address(d.council));
        d.engine.reverse(evt);

        assertEq(uint8(_evt(evt).status), uint8(RedistributionEngine.EventStatus.Reversed));
        assertEq(d.incentives.getIncentive(id).triggerCount, 0, "trigger slot returned");
        assertTrue(d.incentives.isActive(id), "incentive active again");
        assertEq(d.poolA.corpusBalance(), 200e18, "no value moved");

        // a reversed event is never executable
        vm.warp(block.timestamp + 48 hours);
        vm.expectRevert(RedistributionEngine.NotPending.selector);
        d.engine.finalize(evt);

        // the cooldown clock deliberately stays: after it lapses the same
        // incentive can confirm a fresh event in its restored slot
        vm.warp(uint256(d.incentives.getIncentive(id).lastTriggeredAt) + 7 days);
        uint256 evt2 = _confirm(id, "slot2");
        assertEq(evt2, 2);
        assertEq(uint8(_evt(evt2).status), uint8(RedistributionEngine.EventStatus.Pending));
    }

    function test_reverse_windowClosedAtExactly48h() public {
        _enroll();
        uint256 id = _passDefault(Direction.HarmfulByA);
        uint256 evt = _confirm(id, "closed");

        vm.warp(_evt(evt).confirmedAt + 48 hours);
        vm.prank(address(d.council));
        vm.expectRevert(RedistributionEngine.DisputeWindowClosed.selector);
        d.engine.reverse(evt);

        // ...and at the same instant finalize succeeds: no dead zone, no overlap
        d.engine.finalize(evt);
        assertTrue(d.engine.isFinalized(evt));
    }

    function test_reverse_unknownAndNonPending() public {
        _enroll();
        vm.prank(address(d.council));
        vm.expectRevert(RedistributionEngine.UnknownEvent.selector);
        d.engine.reverse(999);

        uint256 id = _passDefault(Direction.HarmfulByA);
        uint256 evt = _confirm(id, "np");
        vm.warp(block.timestamp + 48 hours);
        d.engine.finalize(evt);

        // finalized events cannot be reversed (even though the window check
        // would also fail here, status is checked first)
        vm.prank(address(d.council));
        vm.expectRevert(RedistributionEngine.NotPending.selector);
        d.engine.reverse(evt);
    }

    // ------------------------------------------------------------- DisputeCouncil

    function _seatCouncil(uint256 n) internal returns (address[] memory members) {
        members = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            members[i] = makeAddr(string.concat("council", vm.toString(i)));
            d.council.setMember(members[i], true);
        }
    }

    function test_council_setMember_onlyOwnerAndBookkeeping() public {
        address m1 = makeAddr("m1");
        address m2 = makeAddr("m2");

        vm.prank(guardian);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, guardian)
        );
        d.council.setMember(m1, true);

        d.council.setMember(m1, true);
        assertEq(d.council.memberCount(), 1);
        assertTrue(d.council.isMember(m1));

        // idempotent: re-adding does not double-count
        d.council.setMember(m1, true);
        assertEq(d.council.memberCount(), 1);

        d.council.setMember(m2, true);
        assertEq(d.council.memberCount(), 2);

        d.council.setMember(m1, false);
        assertEq(d.council.memberCount(), 1);
        assertFalse(d.council.isMember(m1));

        // idempotent: removing a non-member does not underflow the count
        d.council.setMember(m1, false);
        assertEq(d.council.memberCount(), 1);
    }

    function test_council_voteReverse_gates() public {
        address[] memory m = _seatCouncil(4);
        _enroll();
        uint256 id = _passDefault(Direction.HarmfulByA);
        uint256 evt = _confirm(id, "gates");

        vm.prank(makeAddr("stranger"));
        vm.expectRevert(DisputeCouncil.NotMember.selector);
        d.council.voteReverse(evt);

        vm.prank(m[0]);
        d.council.voteReverse(evt);
        vm.prank(m[0]);
        vm.expectRevert(DisputeCouncil.AlreadyVoted.selector);
        d.council.voteReverse(evt);
    }

    function test_council_thresholdMath_4members3votes() public {
        address[] memory m = _seatCouncil(4);
        _enroll();
        uint256 id = _passDefault(Direction.HarmfulByA);
        uint256 evt = _confirm(id, "thresh");
        assertEq(d.incentives.getIncentive(id).triggerCount, 1);

        // 2 of 4 = 50% < 75%: no reversal yet
        vm.prank(m[0]);
        d.council.voteReverse(evt);
        vm.prank(m[1]);
        d.council.voteReverse(evt);
        assertEq(d.council.reverseVotes(evt), 2);
        assertFalse(d.council.reversed(evt));
        assertEq(uint8(_evt(evt).status), uint8(RedistributionEngine.EventStatus.Pending));

        // 3 of 4 = exactly 75%: the vote itself executes the reversal
        vm.expectEmit(true, false, false, true, address(d.engine));
        emit EventReversed(evt);
        vm.expectEmit(true, false, false, true, address(d.council));
        emit Reversed(evt);
        vm.prank(m[2]);
        d.council.voteReverse(evt);

        assertTrue(d.council.reversed(evt));
        assertEq(uint8(_evt(evt).status), uint8(RedistributionEngine.EventStatus.Reversed));
        assertEq(d.incentives.getIncentive(id).triggerCount, 0, "trigger slot restored");

        // late fourth vote hits the reversed guard
        vm.prank(m[3]);
        vm.expectRevert(DisputeCouncil.AlreadyReversed.selector);
        d.council.voteReverse(evt);

        // reversed event can never be finalized
        vm.warp(block.timestamp + 48 hours);
        vm.expectRevert(RedistributionEngine.NotPending.selector);
        d.engine.finalize(evt);
        assertEq(d.poolA.corpusBalance(), 200e18, "no value ever moved");
    }

    function test_council_lateThresholdRevertsWithWindow() public {
        address[] memory m = _seatCouncil(4);
        _enroll();
        uint256 id = _passDefault(Direction.HarmfulByA);
        uint256 evt = _confirm(id, "late");

        vm.prank(m[0]);
        d.council.voteReverse(evt);
        vm.prank(m[1]);
        d.council.voteReverse(evt);

        // window lapses before the third vote: engine.reverse reverts, so the
        // whole vote reverts - no phantom "reversed" state in the council
        vm.warp(_evt(evt).confirmedAt + 48 hours);
        vm.prank(m[2]);
        vm.expectRevert(RedistributionEngine.DisputeWindowClosed.selector);
        d.council.voteReverse(evt);

        assertFalse(d.council.reversed(evt));
        assertFalse(d.council.hasVoted(evt, m[2]), "failed vote left no trace");
        assertEq(d.council.reverseVotes(evt), 2);

        d.engine.finalize(evt); // event executes normally
        assertTrue(d.engine.isFinalized(evt));
    }

    // ---------------------------------------------------------- admin plumbing

    function test_setDisputeWindow_boundsAndAuth() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        d.engine.setDisputeWindow(2 days);

        vm.expectRevert(RedistributionEngine.BadWindow.selector);
        d.engine.setDisputeWindow(1 hours - 1);
        vm.expectRevert(RedistributionEngine.BadWindow.selector);
        d.engine.setDisputeWindow(7 days + 1);

        d.engine.setDisputeWindow(1 hours);
        assertEq(d.engine.disputeWindow(), 1 hours);
        d.engine.setDisputeWindow(7 days);
        assertEq(d.engine.disputeWindow(), 7 days);
    }

    function test_setDisputeWindow_governsFinalizeBoundary() public {
        d.engine.setDisputeWindow(1 hours);
        _enroll();
        uint256 id = _passDefault(Direction.HarmfulByA);
        uint256 evt = _confirm(id, "win");
        uint256 confirmedAt = _evt(evt).confirmedAt;

        vm.warp(confirmedAt + 1 hours - 1);
        vm.expectRevert(RedistributionEngine.DisputeWindowOpen.selector);
        d.engine.finalize(evt);
        vm.warp(confirmedAt + 1 hours);
        d.engine.finalize(evt);
        assertTrue(d.engine.isFinalized(evt));
    }

    function test_wire_onlyOnce() public {
        // Deploy already wired attestation + council; a second wire must fail
        vm.expectRevert(RedistributionEngine.AlreadyWired.selector);
        d.engine.wire(makeAddr("fakeAttestation"), makeAddr("fakeCouncil"));

        // and non-owners cannot even try
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        d.engine.wire(makeAddr("x"), makeAddr("y"));
    }
}

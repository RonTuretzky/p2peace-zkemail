// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BaseTest} from "./Base.t.sol";
import {Community, Direction} from "../src/Types.sol";
import {SanctionsEscrow} from "../src/SanctionsEscrow.sol";
import {BusinessRegistry} from "../src/BusinessRegistry.sol";

/// @notice Deep suite for SanctionsEscrow (tranche deposit / release / reclaim and
///         beneficiary routing) and BusinessRegistry (certification & revocation
///         polls, payments, cooperation bonus).
contract EscrowBusinessTest is BaseTest {
    address internal alice = makeAddr("alice"); // community A member
    address internal avi = makeAddr("avi"); //     community A member
    address internal basma = makeAddr("basma"); // community B member
    address internal bilal = makeAddr("bilal"); // community B member
    address internal donor = makeAddr("donor"); //   escrow donor, not a member
    address internal stranger = makeAddr("stranger"); // never enrolled
    address internal bizWalletA = makeAddr("bizWalletA");
    address internal bizWalletB = makeAddr("bizWalletB");

    uint256 internal jointId; // active Joint incentive (empty treasury => finalize moves 0)

    function setUp() public override {
        super.setUp();
        registerAndMint(alice, Community.A, "alice", 1000e18);
        registerAndMint(avi, Community.A, "avi", 1000e18);
        registerAndMint(basma, Community.B, "basma", 1000e18);
        registerAndMint(bilal, Community.B, "bilal", 1000e18);

        jointId = d.incentives.propose(defaultProposal(Direction.Joint));
        passProposal(jointId, _votersA(), _votersB());
    }

    // ---------------------------------------------------------------- helpers

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

    /// @dev Confirm an event for `incId` (returns pending event id).
    function _confirmEvent(uint256 incId, string memory seed) internal returns (uint256) {
        confirmDefaultEvent(incId, uint64(block.timestamp - 1 hours), seed);
        return d.engine.eventCount();
    }

    /// @dev Confirm + ride out dispute window + finalize.
    function _finalizedEvent(uint256 incId, string memory seed) internal returns (uint256 id) {
        id = _confirmEvent(incId, seed);
        vm.warp(block.timestamp + 48 hours);
        d.engine.finalize(id);
    }

    function _deposit(
        uint256 incId,
        SanctionsEscrow.Beneficiary beneficiary,
        uint256 amount,
        uint64 expiry
    ) internal returns (uint256 trancheId) {
        d.usd.mint(donor, amount);
        vm.startPrank(donor);
        d.usd.approve(address(d.escrow), amount);
        trancheId = d.escrow.deposit(incId, beneficiary, amount, expiry);
        vm.stopPrank();
    }

    function _fundTreasury(uint256 amount) internal {
        d.usd.mint(address(this), amount);
        d.usd.approve(address(d.treasury), amount);
        d.treasury.donate(amount);
    }

    function _assertReserveInvariant() internal view {
        assertEq(d.usd.balanceOf(address(d.minterA)), d.tokenA.totalSupply(), "A reserve");
        assertEq(d.usd.balanceOf(address(d.minterB)), d.tokenB.totalSupply(), "B reserve");
    }

    function _applyBiz(address wallet, Community community) internal returns (uint256 id) {
        vm.prank(wallet);
        id = d.business.applyForCertification(community, "ipfs://biz");
    }

    function _voteBiz(uint256 id, address voter, bool support) internal {
        vm.prank(voter);
        d.business.vote(id, support);
    }

    /// @dev Apply + unanimous yes from one member per community + finalize.
    function _certifiedBiz(address wallet, Community community) internal returns (uint256 id) {
        id = _applyBiz(wallet, community);
        _voteBiz(id, alice, true);
        _voteBiz(id, basma, true);
        vm.warp(block.timestamp + d.business.votingPeriod());
        d.business.finalizePoll(id);
        assertEq(uint8(_status(id)), uint8(BusinessRegistry.BizStatus.Certified));
    }

    function _status(uint256 id) internal view returns (BusinessRegistry.BizStatus status) {
        (,,, status,,,,,,) = d.business.businesses(id);
    }

    function _poll(uint256 id)
        internal
        view
        returns (uint64 votingEnd, uint64 session, uint256 yesA, uint256 noA, uint256 yesB,
            uint256 noB)
    {
        (,,,, votingEnd, session, yesA, noA, yesB, noB) = d.business.businesses(id);
    }

    function _pay(address payer, uint256 bizId, uint256 amount) internal {
        vm.startPrank(payer);
        (d.identity.communityOf(payer) == Community.A ? d.tokenA : d.tokenB).approve(
            address(d.business), amount
        );
        d.business.payBusiness(bizId, amount);
        vm.stopPrank();
    }

    // ======================================================== SanctionsEscrow

    // ------------------------------------------------------------ deposit

    function test_deposit_zeroAmountReverts() public {
        vm.expectRevert(SanctionsEscrow.BadTranche.selector);
        d.escrow.deposit(
            jointId, SanctionsEscrow.Beneficiary.PoolA, 0, uint64(block.timestamp + 1 days)
        );
    }

    function test_deposit_expiryBoundary() public {
        d.usd.mint(donor, 2e18);
        vm.startPrank(donor);
        d.usd.approve(address(d.escrow), 2e18);

        // expiry == now is already "past" (expiry <= block.timestamp reverts)
        vm.expectRevert(SanctionsEscrow.BadTranche.selector);
        d.escrow.deposit(jointId, SanctionsEscrow.Beneficiary.PoolA, 1e18,
            uint64(block.timestamp));

        // expiry == now + 1 is the minimum valid expiry
        uint256 id = d.escrow.deposit(
            jointId, SanctionsEscrow.Beneficiary.PoolA, 1e18, uint64(block.timestamp + 1)
        );
        vm.stopPrank();
        assertEq(id, 1);
    }

    function test_deposit_pullsFundsAndRecordsTranche() public {
        uint64 expiry = uint64(block.timestamp + 30 days);
        uint256 id = _deposit(jointId, SanctionsEscrow.Beneficiary.Both, 250e18, expiry);

        assertEq(id, 1);
        assertEq(d.escrow.trancheCount(), 1);
        assertEq(d.usd.balanceOf(address(d.escrow)), 250e18, "funds pulled");
        assertEq(d.usd.balanceOf(donor), 0);

        (
            address tDonor,
            uint256 tIncentive,
            SanctionsEscrow.Beneficiary tBeneficiary,
            uint256 tAmount,
            uint64 tExpiry,
            bool released,
            bool reclaimed
        ) = d.escrow.tranches(id);
        assertEq(tDonor, donor);
        assertEq(tIncentive, jointId);
        assertEq(uint8(tBeneficiary), uint8(SanctionsEscrow.Beneficiary.Both));
        assertEq(tAmount, 250e18);
        assertEq(tExpiry, expiry);
        assertFalse(released);
        assertFalse(reclaimed);
    }

    // ------------------------------------------------------------ release

    function test_release_unknownTrancheReverts() public {
        uint256 eventId = _finalizedEvent(jointId, "evt-unknown-tranche");
        vm.expectRevert(SanctionsEscrow.BadTranche.selector);
        d.escrow.release(42, eventId);
    }

    function test_release_pendingEventReverts() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.PoolA, 100e18, uint64(block.timestamp + 60 days)
        );
        uint256 eventId = _confirmEvent(jointId, "evt-pending");
        vm.expectRevert(SanctionsEscrow.EventNotFinalized.selector);
        d.escrow.release(trancheId, eventId);
    }

    function test_release_reversedEventReverts() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.PoolA, 100e18, uint64(block.timestamp + 60 days)
        );
        uint256 eventId = _confirmEvent(jointId, "evt-reversed");

        // Council of one (this test contract) reverses inside the dispute window.
        d.council.setMember(address(this), true);
        d.council.voteReverse(eventId);

        vm.expectRevert(SanctionsEscrow.EventNotFinalized.selector);
        d.escrow.release(trancheId, eventId);

        // Still no luck after the window: the event stays Reversed, never Finalized.
        vm.warp(block.timestamp + 48 hours);
        vm.expectRevert(SanctionsEscrow.EventNotFinalized.selector);
        d.escrow.release(trancheId, eventId);
    }

    function test_release_nonexistentEventReverts() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.PoolA, 100e18, uint64(block.timestamp + 60 days)
        );
        vm.expectRevert(SanctionsEscrow.EventNotFinalized.selector);
        d.escrow.release(trancheId, 999);
    }

    function test_release_incentiveMismatchReverts() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.PoolA, 100e18, uint64(block.timestamp + 90 days)
        );

        // A second, unrelated incentive produces the finalized event.
        uint256 otherId = d.incentives.propose(defaultProposal(Direction.Joint));
        passProposal(otherId, _votersA(), _votersB());
        uint256 eventId = _finalizedEvent(otherId, "evt-other-incentive");
        assertTrue(d.engine.isFinalized(eventId));

        vm.expectRevert(SanctionsEscrow.EventIncentiveMismatch.selector);
        d.escrow.release(trancheId, eventId);
    }

    function test_release_poolA_mintsRewardsAtPar() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.PoolA, 100e18, uint64(block.timestamp + 60 days)
        );
        uint256 eventId = _finalizedEvent(jointId, "evt-poolA");

        uint256 poolTokensBefore = d.tokenA.balanceOf(address(d.poolA));
        uint256 corpusBefore = d.poolA.corpusBalance();
        assertEq(d.poolA.claimable(alice), 0);

        d.escrow.release(trancheId, eventId);

        assertEq(d.usd.balanceOf(address(d.escrow)), 0, "escrow drained");
        assertEq(
            d.tokenA.balanceOf(address(d.poolA)), poolTokensBefore + 100e18,
            "tokens minted into pool A"
        );
        assertEq(d.poolA.corpusBalance(), corpusBefore, "corpus untouched - rewards bucket");
        assertEq(d.poolA.claimable(alice), 50e18, "equal share, 2 A members");
        assertEq(d.poolA.claimable(avi), 50e18);
        assertEq(d.poolB.claimable(basma), 0, "pool B untouched");
        _assertReserveInvariant();
    }

    function test_release_poolB_mintsRewardsAtPar() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.PoolB, 90e18, uint64(block.timestamp + 60 days)
        );
        uint256 eventId = _finalizedEvent(jointId, "evt-poolB");

        uint256 poolTokensBefore = d.tokenB.balanceOf(address(d.poolB));
        d.escrow.release(trancheId, eventId);

        assertEq(d.tokenB.balanceOf(address(d.poolB)), poolTokensBefore + 90e18);
        assertEq(d.poolB.claimable(basma), 45e18);
        assertEq(d.poolB.claimable(bilal), 45e18);
        assertEq(d.poolA.claimable(alice), 0, "pool A untouched");
        _assertReserveInvariant();
    }

    function test_release_both_splitsOddWei() public {
        uint256 amount = 100e18 + 1; // odd: A gets half, B gets the extra wei
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.Both, amount, uint64(block.timestamp + 60 days)
        );
        uint256 eventId = _finalizedEvent(jointId, "evt-both");

        uint256 poolABefore = d.tokenA.balanceOf(address(d.poolA));
        uint256 poolBBefore = d.tokenB.balanceOf(address(d.poolB));

        d.escrow.release(trancheId, eventId);

        assertEq(d.tokenA.balanceOf(address(d.poolA)), poolABefore + 50e18, "A half");
        assertEq(d.tokenB.balanceOf(address(d.poolB)), poolBBefore + 50e18 + 1, "B half + wei");
        assertEq(d.usd.balanceOf(address(d.escrow)), 0, "nothing stranded");
        _assertReserveInvariant();
    }

    function test_release_both_oneWeiAllToB() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.Both, 1, uint64(block.timestamp + 60 days)
        );
        uint256 eventId = _finalizedEvent(jointId, "evt-one-wei");

        uint256 poolABefore = d.tokenA.balanceOf(address(d.poolA));
        uint256 poolBBefore = d.tokenB.balanceOf(address(d.poolB));

        d.escrow.release(trancheId, eventId); // half = 0: A leg is a no-op, no revert

        assertEq(d.tokenA.balanceOf(address(d.poolA)), poolABefore);
        assertEq(d.tokenB.balanceOf(address(d.poolB)), poolBBefore + 1);
        _assertReserveInvariant();
    }

    function test_release_treasury_sendsUsdStraight() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.Treasury, 77e18,
            uint64(block.timestamp + 60 days)
        );
        uint256 eventId = _finalizedEvent(jointId, "evt-treasury");

        uint256 supplyA = d.tokenA.totalSupply();
        uint256 supplyB = d.tokenB.totalSupply();
        uint256 treasuryBefore = d.treasury.balance();

        d.escrow.release(trancheId, eventId);

        assertEq(d.treasury.balance(), treasuryBefore + 77e18, "USD straight to treasury");
        assertEq(d.tokenA.totalSupply(), supplyA, "no tokens minted");
        assertEq(d.tokenB.totalSupply(), supplyB, "no tokens minted");
        assertEq(d.usd.balanceOf(address(d.escrow)), 0);
    }

    function test_release_byAnyCaller() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.Treasury, 10e18,
            uint64(block.timestamp + 60 days)
        );
        uint256 eventId = _finalizedEvent(jointId, "evt-any-caller");

        vm.prank(stranger); // not donor, not member, not owner
        d.escrow.release(trancheId, eventId);
        (,,,,, bool released,) = d.escrow.tranches(trancheId);
        assertTrue(released);
    }

    function test_release_afterExpiryIfNotReclaimed() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.PoolB, 10e18, uint64(block.timestamp + 1 days)
        );
        uint256 eventId = _finalizedEvent(jointId, "evt-late"); // warps 48h > expiry
        (,,,, uint64 expiry,,) = d.escrow.tranches(trancheId);
        assertGt(block.timestamp, expiry, "tranche is past expiry");

        d.escrow.release(trancheId, eventId); // donor never reclaimed => still valid
        (,,,,, bool released,) = d.escrow.tranches(trancheId);
        assertTrue(released);
    }

    function test_release_twiceReverts() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.Treasury, 10e18,
            uint64(block.timestamp + 60 days)
        );
        uint256 eventId = _finalizedEvent(jointId, "evt-double");
        d.escrow.release(trancheId, eventId);

        vm.expectRevert(SanctionsEscrow.TrancheClosed.selector);
        d.escrow.release(trancheId, eventId);
    }

    function test_release_afterReclaimReverts() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.PoolA, 10e18, uint64(block.timestamp + 1 days)
        );
        uint256 eventId = _finalizedEvent(jointId, "evt-reclaimed-first"); // warps 48h
        vm.prank(donor);
        d.escrow.reclaim(trancheId);

        vm.expectRevert(SanctionsEscrow.TrancheClosed.selector);
        d.escrow.release(trancheId, eventId);
    }

    // ------------------------------------------------------------ reclaim

    function test_reclaim_notDonorReverts() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.PoolA, 10e18, uint64(block.timestamp + 1 days)
        );
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(stranger);
        vm.expectRevert(SanctionsEscrow.NotDonor.selector);
        d.escrow.reclaim(trancheId);
    }

    function test_reclaim_expiryBoundaryAndExactRefund() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        uint256 trancheId = _deposit(jointId, SanctionsEscrow.Beneficiary.PoolA, 33e18, expiry);

        // exactly at expiry: still not reclaimable
        vm.warp(expiry);
        vm.prank(donor);
        vm.expectRevert(SanctionsEscrow.NotExpired.selector);
        d.escrow.reclaim(trancheId);

        // one second past expiry: refund lands, exact
        vm.warp(uint256(expiry) + 1);
        vm.prank(donor);
        d.escrow.reclaim(trancheId);
        assertEq(d.usd.balanceOf(donor), 33e18, "exact refund");
        assertEq(d.usd.balanceOf(address(d.escrow)), 0);
        (,,,,,, bool reclaimed) = d.escrow.tranches(trancheId);
        assertTrue(reclaimed);
    }

    function test_reclaim_afterReleaseReverts() public {
        uint256 trancheId = _deposit(
            jointId, SanctionsEscrow.Beneficiary.Treasury, 10e18,
            uint64(block.timestamp + 1 days)
        );
        uint256 eventId = _finalizedEvent(jointId, "evt-release-then-reclaim"); // warps 48h
        d.escrow.release(trancheId, eventId);

        vm.prank(donor);
        vm.expectRevert(SanctionsEscrow.TrancheClosed.selector);
        d.escrow.reclaim(trancheId);
    }

    function test_reclaim_twiceReverts() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        uint256 trancheId = _deposit(jointId, SanctionsEscrow.Beneficiary.PoolA, 10e18, expiry);
        vm.warp(uint256(expiry) + 1);
        vm.startPrank(donor);
        d.escrow.reclaim(trancheId);
        vm.expectRevert(SanctionsEscrow.TrancheClosed.selector);
        d.escrow.reclaim(trancheId);
        vm.stopPrank();
    }

    // ======================================================= BusinessRegistry

    // ------------------------------------------------------- certification

    function test_apply_noneCommunityReverts() public {
        vm.prank(bizWalletA);
        vm.expectRevert(BusinessRegistry.BadBusiness.selector);
        d.business.applyForCertification(Community.None, "ipfs://biz");
    }

    function test_apply_opensPoll() public {
        uint256 id = _applyBiz(bizWalletA, Community.A);
        assertEq(id, 1);
        assertEq(d.business.businessCount(), 1);
        assertEq(uint8(_status(id)), uint8(BusinessRegistry.BizStatus.CertVote));
        (uint64 votingEnd, uint64 session, uint256 yesA, uint256 noA, uint256 yesB, uint256 noB)
            = _poll(id);
        assertEq(votingEnd, uint64(block.timestamp) + d.business.votingPeriod());
        assertEq(session, 1);
        assertEq(yesA + noA + yesB + noB, 0);
    }

    function test_vote_notActiveMemberReverts() public {
        uint256 id = _applyBiz(bizWalletA, Community.A);
        vm.prank(stranger);
        vm.expectRevert(BusinessRegistry.NotActiveMember.selector);
        d.business.vote(id, true);
    }

    function test_vote_unknownBizNotVoting() public {
        vm.prank(alice);
        vm.expectRevert(BusinessRegistry.NotVoting.selector);
        d.business.vote(42, true);
    }

    function test_vote_afterFinalizeNotVoting() public {
        uint256 id = _certifiedBiz(bizWalletA, Community.A);
        vm.prank(avi);
        vm.expectRevert(BusinessRegistry.NotVoting.selector);
        d.business.vote(id, true);
    }

    function test_vote_votingClosedAtExactEnd() public {
        uint256 id = _applyBiz(bizWalletA, Community.A);
        (uint64 votingEnd,,,,,) = _poll(id);

        vm.warp(uint256(votingEnd) - 1); // last valid second
        _voteBiz(id, alice, true);

        vm.warp(votingEnd); // >= votingEnd: closed
        vm.prank(basma);
        vm.expectRevert(BusinessRegistry.VotingClosed.selector);
        d.business.vote(id, true);
    }

    function test_vote_alreadyVotedPerNullifierPerSession() public {
        uint256 id = _applyBiz(bizWalletA, Community.A);
        _voteBiz(id, alice, true);
        vm.prank(alice);
        vm.expectRevert(BusinessRegistry.AlreadyVoted.selector);
        d.business.vote(id, false);
    }

    function test_finalizePoll_votingStillOpenBoundary() public {
        uint256 id = _applyBiz(bizWalletA, Community.A);
        _voteBiz(id, alice, true);
        _voteBiz(id, basma, true);
        (uint64 votingEnd,,,,,) = _poll(id);

        vm.warp(uint256(votingEnd) - 1);
        vm.expectRevert(BusinessRegistry.VotingStillOpen.selector);
        d.business.finalizePoll(id);

        vm.warp(votingEnd); // exactly at end: finalizable
        d.business.finalizePoll(id);
        assertEq(uint8(_status(id)), uint8(BusinessRegistry.BizStatus.Certified));
    }

    function test_finalizePoll_dualMajority_BTieRejects() public {
        uint256 id = _applyBiz(bizWalletA, Community.A);
        _voteBiz(id, alice, true);
        _voteBiz(id, avi, true); //   A: 2 yes / 0 no - clear majority
        _voteBiz(id, basma, true);
        _voteBiz(id, bilal, false); // B: 1 yes / 1 no - tie is not a majority
        vm.warp(block.timestamp + d.business.votingPeriod());
        d.business.finalizePoll(id);
        assertEq(uint8(_status(id)), uint8(BusinessRegistry.BizStatus.Rejected));
    }

    function test_finalizePoll_noVotesRejects() public {
        uint256 id = _applyBiz(bizWalletA, Community.A);
        vm.warp(block.timestamp + d.business.votingPeriod());
        d.business.finalizePoll(id);
        assertEq(uint8(_status(id)), uint8(BusinessRegistry.BizStatus.Rejected));
    }

    function test_finalizePoll_onRejectedNotVoting() public {
        uint256 id = _applyBiz(bizWalletA, Community.A);
        vm.warp(block.timestamp + d.business.votingPeriod());
        d.business.finalizePoll(id); // Rejected
        vm.expectRevert(BusinessRegistry.NotVoting.selector);
        d.business.finalizePoll(id);
    }

    // ---------------------------------------------------------- revocation

    function test_openRevocation_notMemberReverts() public {
        uint256 id = _certifiedBiz(bizWalletA, Community.A);
        vm.prank(stranger);
        vm.expectRevert(BusinessRegistry.NotActiveMember.selector);
        d.business.openRevocation(id);
    }

    function test_openRevocation_onlyOnCertified() public {
        // mid cert-vote
        uint256 pending = _applyBiz(bizWalletA, Community.A);
        vm.prank(alice);
        vm.expectRevert(BusinessRegistry.NotCertified.selector);
        d.business.openRevocation(pending);

        // rejected
        vm.warp(block.timestamp + d.business.votingPeriod());
        d.business.finalizePoll(pending);
        vm.prank(alice);
        vm.expectRevert(BusinessRegistry.NotCertified.selector);
        d.business.openRevocation(pending);
    }

    function test_revocation_sessionBumpResetsTalliesAndAllowsRevote() public {
        uint256 id = _certifiedBiz(bizWalletA, Community.A); // alice + basma voted, session 1

        vm.prank(alice);
        d.business.openRevocation(id);

        assertEq(uint8(_status(id)), uint8(BusinessRegistry.BizStatus.RevokeVote));
        (, uint64 session, uint256 yesA, uint256 noA, uint256 yesB, uint256 noB) = _poll(id);
        assertEq(session, 2, "session bumped");
        assertEq(yesA + noA + yesB + noB, 0, "tallies reset");

        // Same nullifiers vote again in the new session - no AlreadyVoted.
        _voteBiz(id, alice, true);
        _voteBiz(id, basma, true);
        (,, yesA,, yesB,) = _poll(id);
        assertEq(yesA, 1);
        assertEq(yesB, 1);
    }

    function test_revocation_passingRevokes() public {
        uint256 id = _certifiedBiz(bizWalletA, Community.A);
        vm.prank(alice);
        d.business.openRevocation(id);
        _voteBiz(id, alice, true);
        _voteBiz(id, basma, true);
        vm.warp(block.timestamp + d.business.votingPeriod());
        d.business.finalizePoll(id);
        assertEq(uint8(_status(id)), uint8(BusinessRegistry.BizStatus.Revoked));

        // Revoked businesses can neither be paid nor re-put to revocation.
        vm.prank(alice);
        vm.expectRevert(BusinessRegistry.NotCertified.selector);
        d.business.payBusiness(id, 1e18);
        vm.prank(alice);
        vm.expectRevert(BusinessRegistry.NotCertified.selector);
        d.business.openRevocation(id);
    }

    function test_revocation_failingRestoresCertified() public {
        uint256 id = _certifiedBiz(bizWalletA, Community.A);
        vm.prank(alice);
        d.business.openRevocation(id);
        _voteBiz(id, alice, true); //  A majority for revocation
        _voteBiz(id, basma, false); // B against - dual majority fails
        vm.warp(block.timestamp + d.business.votingPeriod());
        d.business.finalizePoll(id);
        assertEq(uint8(_status(id)), uint8(BusinessRegistry.BizStatus.Certified));

        // Still payable afterwards.
        _pay(alice, id, 1e18);
        assertEq(d.tokenA.balanceOf(bizWalletA), 1e18);
    }

    // ------------------------------------------------------------ payments

    function test_pay_notCertifiedStates() public {
        // mid cert-vote
        uint256 pending = _applyBiz(bizWalletA, Community.A);
        vm.prank(alice);
        vm.expectRevert(BusinessRegistry.NotCertified.selector);
        d.business.payBusiness(pending, 1e18);

        // rejected
        vm.warp(block.timestamp + d.business.votingPeriod());
        d.business.finalizePoll(pending);
        vm.prank(alice);
        vm.expectRevert(BusinessRegistry.NotCertified.selector);
        d.business.payBusiness(pending, 1e18);

        // certified then mid revoke-vote: not payable either
        uint256 certified = _certifiedBiz(bizWalletB, Community.B);
        vm.prank(alice);
        d.business.openRevocation(certified);
        vm.prank(alice);
        vm.expectRevert(BusinessRegistry.NotCertified.selector);
        d.business.payBusiness(certified, 1e18);
    }

    function test_pay_notActiveMemberReverts() public {
        uint256 id = _certifiedBiz(bizWalletA, Community.A);
        vm.prank(stranger);
        vm.expectRevert(BusinessRegistry.NotActiveMember.selector);
        d.business.payBusiness(id, 1e18);
    }

    function test_pay_sameCommunityNoBonus() public {
        _fundTreasury(1000e18); // money is there - it must simply not move
        uint256 id = _certifiedBiz(bizWalletA, Community.A);
        uint256 treasuryBefore = d.treasury.balance();

        _pay(alice, id, 100e18);

        assertEq(d.tokenA.balanceOf(bizWalletA), 100e18, "payment in tokenA");
        assertEq(d.usd.balanceOf(bizWalletA), 0, "no bonus");
        assertEq(d.treasury.balance(), treasuryBefore, "treasury untouched");
    }

    function test_pay_crossCommunityBonusFromTreasury() public {
        _fundTreasury(1000e18);
        uint256 id = _certifiedBiz(bizWalletB, Community.B);
        uint256 aliceTokenABefore = d.tokenA.balanceOf(alice);

        _pay(alice, id, 100e18); // A member pays a B business

        // Payment always rides the payer's community token, even cross-line.
        assertEq(d.tokenA.balanceOf(bizWalletB), 100e18, "paid in payer's tokenA");
        assertEq(d.tokenB.balanceOf(bizWalletB), 0, "no tokenB involved");
        assertEq(d.tokenA.balanceOf(alice), aliceTokenABefore - 100e18);

        // 2% cooperation bonus in USD, from the treasury.
        assertEq(d.usd.balanceOf(bizWalletB), 2e18, "2% bonus in USD");
        assertEq(d.treasury.balance(), 1000e18 - 2e18, "bonus from treasury");
    }

    function test_pay_crossCommunityBPayerUsesTokenB() public {
        _fundTreasury(1000e18);
        uint256 id = _certifiedBiz(bizWalletA, Community.A);

        _pay(basma, id, 50e18); // B member pays an A business

        assertEq(d.tokenB.balanceOf(bizWalletA), 50e18, "paid in payer's tokenB");
        assertEq(d.tokenA.balanceOf(bizWalletA), 0);
        assertEq(d.usd.balanceOf(bizWalletA), 1e18, "2% of 50");
    }

    function test_pay_bonusCappedByEpochBudget() public {
        _fundTreasury(1e18);
        uint256 id = _certifiedBiz(bizWalletB, Community.B);

        _pay(alice, id, 100e18); // formula bonus would be 2e18

        // Epoch budget = 1% of the 1e18 treasury snapshot, NOT the full balance:
        // a single oversized payment can no longer drain the war chest.
        assertEq(d.usd.balanceOf(bizWalletB), 0.01e18, "bonus capped at epoch budget");
        assertEq(d.treasury.balance(), 0.99e18, "treasury survives");
        assertEq(d.tokenA.balanceOf(bizWalletB), 100e18, "payment unaffected");
    }

    /// @notice Wash-trade containment: a self-dealing certified business looping
    ///         cross-community payments extracts at most epochBudgetBps of the
    ///         treasury per epoch — slow enough for a 3-day revocation poll.
    function test_pay_washTradeBoundedPerEpoch() public {
        _fundTreasury(100e18);
        uint256 id = _certifiedBiz(bizWalletB, Community.B);

        for (uint256 i = 0; i < 5; i++) {
            _pay(alice, id, 100e18); // 2e18 requested per loop
        }
        assertEq(d.usd.balanceOf(bizWalletB), 1e18, "whole epoch budget (1% of 100)");
        assertEq(d.treasury.balance(), 99e18, "99% intact within the epoch");

        // Next epoch: fresh budget from the new snapshot, and no more.
        vm.warp(block.timestamp + d.business.bonusEpoch());
        _pay(alice, id, 100e18);
        _pay(alice, id, 100e18);
        assertEq(d.usd.balanceOf(bizWalletB), 1e18 + 0.99e18, "1% of the 99e18 snapshot");
    }

    function test_pay_emptyTreasuryZeroBonusStillPays() public {
        uint256 id = _certifiedBiz(bizWalletB, Community.B);
        assertEq(d.treasury.balance(), 0);

        _pay(alice, id, 100e18);

        assertEq(d.usd.balanceOf(bizWalletB), 0, "zero bonus");
        assertEq(d.tokenA.balanceOf(bizWalletB), 100e18, "payment still succeeds");
    }

    // ----------------------------------------------------- bonus governance

    function test_setCooperationBonus_boundsAndOwner() public {
        // > 10% is out of bounds
        vm.expectRevert(BusinessRegistry.BadParams.selector);
        d.business.setCooperationBonus(1_001);

        // non-owner cannot set
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        d.business.setCooperationBonus(100);

        // max bound accepted, zero accepted
        d.business.setCooperationBonus(1_000);
        assertEq(d.business.cooperationBonusBps(), 1_000);
        d.business.setCooperationBonus(0);
        assertEq(d.business.cooperationBonusBps(), 0);
    }

    function test_setCooperationBonus_changesPayout() public {
        _fundTreasury(1000e18);
        d.business.setCooperationBonus(500); // 5%
        uint256 id = _certifiedBiz(bizWalletB, Community.B);

        _pay(alice, id, 100e18);
        assertEq(d.usd.balanceOf(bizWalletB), 5e18, "5% bonus after param change");
    }
}

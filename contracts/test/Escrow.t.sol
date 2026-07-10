// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {Community, Direction} from "../src/Types.sol";
import {SanctionsEscrow} from "../src/SanctionsEscrow.sol";

/// @notice SanctionsEscrow: tranche deposit / release / reclaim and beneficiary
///         routing against real finalized events.
contract EscrowTest is BaseTest {
    address internal alice = makeAddr("alice");
    address internal avi = makeAddr("avi");
    address internal basma = makeAddr("basma");
    address internal bilal = makeAddr("bilal");
    address internal donor = makeAddr("donor");

    uint256 internal jointId;

    function setUp() public override {
        super.setUp();
        registerAndMint(alice, Community.A, "alice", 1000e18);
        registerAndMint(avi, Community.A, "avi", 1000e18);
        registerAndMint(basma, Community.B, "basma", 1000e18);
        registerAndMint(bilal, Community.B, "bilal", 1000e18);

        jointId = d.incentives.propose(defaultProposal(Direction.Joint));
        address[] memory votersA = new address[](2);
        votersA[0] = alice;
        votersA[1] = avi;
        address[] memory votersB = new address[](2);
        votersB[0] = basma;
        votersB[1] = bilal;
        passProposal(jointId, votersA, votersB);
    }

    // ---------------------------------------------------------------- helpers

    function _confirmEvent(uint256 incId, string memory seed) internal returns (uint256) {
        confirmDefaultEvent(incId, uint64(block.timestamp - 1 hours), seed);
        return d.engine.eventCount();
    }

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
        mintUsd(donor, amount);
        vm.startPrank(donor);
        d.usd.approve(address(d.escrow), amount);
        trancheId = d.escrow.deposit(incId, beneficiary, amount, expiry);
        vm.stopPrank();
    }

    function _assertReserves() internal view {
        assertEq(d.usd.balanceOf(address(d.minterA)), d.tokenA.totalSupply(), "A reserve");
        assertEq(d.usd.balanceOf(address(d.minterB)), d.tokenB.totalSupply(), "B reserve");
    }

    // ---------------------------------------------------------------- deposit

    function test_deposit_validationAndRecord() public {
        vm.expectRevert(SanctionsEscrow.BadTranche.selector);
        d.escrow.deposit(jointId, SanctionsEscrow.Beneficiary.PoolA, 0, uint64(block.timestamp + 1));

        vm.expectRevert(SanctionsEscrow.BadTranche.selector);
        d.escrow.deposit(jointId, SanctionsEscrow.Beneficiary.PoolA, 1e18, uint64(block.timestamp));

        uint64 expiry = uint64(block.timestamp + 30 days);
        uint256 id = _deposit(jointId, SanctionsEscrow.Beneficiary.Both, 250e18, expiry);
        assertEq(id, 1);
        assertEq(d.escrow.trancheCount(), 1);
        assertEq(d.usd.balanceOf(address(d.escrow)), 250e18, "funds pulled");

        (
            address tDonor,
            uint256 tIncentive,
            SanctionsEscrow.Beneficiary tBen,
            uint256 tAmount,
            uint64 tExpiry,
            bool released,
            bool reclaimed
        ) = d.escrow.tranches(id);
        assertEq(tDonor, donor);
        assertEq(tIncentive, jointId);
        assertEq(uint8(tBen), uint8(SanctionsEscrow.Beneficiary.Both));
        assertEq(tAmount, 250e18);
        assertEq(tExpiry, expiry);
        assertFalse(released);
        assertFalse(reclaimed);
    }

    // ---------------------------------------------------------------- release

    function test_release_guards() public {
        uint256 tid = _deposit(
            jointId, SanctionsEscrow.Beneficiary.Treasury, 10e18, uint64(block.timestamp + 30 days)
        );

        // unknown tranche
        uint256 evt = _finalizedEvent(jointId, "guard");
        vm.expectRevert(SanctionsEscrow.BadTranche.selector);
        d.escrow.release(42, evt);

        // pending (not finalized) event
        uint256 tid2 = _deposit(
            jointId, SanctionsEscrow.Beneficiary.Treasury, 5e18, uint64(block.timestamp + 30 days)
        );
        vm.warp(block.timestamp + 7 days + 1); // clear trigger cooldown
        uint256 pendingEvt = _confirmEvent(jointId, "pending");
        vm.expectRevert(SanctionsEscrow.EventNotFinalized.selector);
        d.escrow.release(tid2, pendingEvt);

        // event of a different incentive
        uint256 otherInc = d.incentives.propose(defaultProposal(Direction.PositiveForA));
        address[] memory votersA = new address[](2);
        votersA[0] = alice;
        votersA[1] = avi;
        address[] memory votersB = new address[](2);
        votersB[0] = basma;
        votersB[1] = bilal;
        passProposal(otherInc, votersA, votersB);
        uint256 otherEvt = _finalizedEvent(otherInc, "other");
        vm.expectRevert(SanctionsEscrow.EventIncentiveMismatch.selector);
        d.escrow.release(tid2, otherEvt);

        // double release
        d.escrow.release(tid, evt);
        vm.expectRevert(SanctionsEscrow.TrancheClosed.selector);
        d.escrow.release(tid, evt);
    }

    function test_release_routesToTreasury() public {
        uint256 tid = _deposit(
            jointId, SanctionsEscrow.Beneficiary.Treasury, 40e18, uint64(block.timestamp + 30 days)
        );
        uint256 before = d.treasury.balance();
        uint256 evt = _finalizedEvent(jointId, "toTreasury");
        d.escrow.release(tid, evt);
        assertEq(d.treasury.balance(), before + 40e18);
    }

    function test_release_routesToPools_atParWithBackingIntact() public {
        uint256 tidA = _deposit(
            jointId, SanctionsEscrow.Beneficiary.PoolA, 30e18, uint64(block.timestamp + 30 days)
        );
        uint256 tidBoth = _deposit(
            jointId, SanctionsEscrow.Beneficiary.Both, 25e18, uint64(block.timestamp + 30 days)
        );

        uint256 evt = _finalizedEvent(jointId, "pools");
        uint256 claimableBeforeA = d.poolA.claimable(alice);

        d.escrow.release(tidA, evt);
        // 30e18 minted at par into pool A rewards: 15e18 claimable per A-member.
        assertEq(d.poolA.claimable(alice), claimableBeforeA + 15e18);
        _assertReserves();

        d.escrow.release(tidBoth, evt); // 12.5e18 per pool, odd split handled
        assertEq(d.usd.balanceOf(address(d.escrow)), 0, "escrow fully drained");
        _assertReserves();
    }

    function test_release_permissionless_andValidAfterExpiryUntilReclaim() public {
        uint256 tid = _deposit(
            jointId, SanctionsEscrow.Beneficiary.Treasury, 5e18, uint64(block.timestamp + 1 days)
        );
        uint256 evt = _finalizedEvent(jointId, "late");
        vm.warp(block.timestamp + 2 days); // past expiry, not reclaimed
        vm.prank(makeAddr("anyone"));
        d.escrow.release(tid, evt);
        (,,,,, bool released,) = d.escrow.tranches(tid);
        assertTrue(released);
    }

    // ---------------------------------------------------------------- reclaim

    function test_reclaim_guardsAndRefund() public {
        uint64 expiry = uint64(block.timestamp + 3 days);
        uint256 tid = _deposit(jointId, SanctionsEscrow.Beneficiary.PoolB, 12e18, expiry);

        vm.expectRevert(SanctionsEscrow.NotDonor.selector);
        d.escrow.reclaim(tid);

        vm.startPrank(donor);
        vm.expectRevert(SanctionsEscrow.NotExpired.selector);
        d.escrow.reclaim(tid);

        vm.warp(expiry); // boundary: exactly expiry still reverts
        vm.expectRevert(SanctionsEscrow.NotExpired.selector);
        d.escrow.reclaim(tid);

        vm.warp(uint256(expiry) + 1);
        d.escrow.reclaim(tid);
        assertEq(d.usd.balanceOf(donor), 12e18, "refund exact");

        vm.expectRevert(SanctionsEscrow.TrancheClosed.selector);
        d.escrow.reclaim(tid);
        vm.stopPrank();

        // release after reclaim is closed
        uint256 evt = _finalizedEvent(jointId, "postreclaim");
        vm.expectRevert(SanctionsEscrow.TrancheClosed.selector);
        d.escrow.release(tid, evt);
    }
}

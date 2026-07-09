// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {Community, Direction} from "../src/Types.sol";

/// @notice End-to-end sanity pass over the whole pipeline; the deep per-module
///         suites live in the sibling test files.
contract SmokeTest is BaseTest {
    function test_fullLifecycle() public {
        // 1. Enroll two members per community; each mints 1000 mUSD.
        address alice = makeAddr("alice");
        address avi = makeAddr("avi");
        address basma = makeAddr("basma");
        address bilal = makeAddr("bilal");
        registerAndMint(alice, Community.A, "alice", 1000e18);
        registerAndMint(avi, Community.A, "avi", 1000e18);
        registerAndMint(basma, Community.B, "basma", 1000e18);
        registerAndMint(bilal, Community.B, "bilal", 1000e18);

        assertEq(d.tokenA.balanceOf(alice), 900e18, "90% to minter");
        assertEq(d.poolA.corpusBalance(), 200e18, "10% x2 staked");
        assertEq(d.usd.balanceOf(address(d.minterA)), 2000e18, "reserve = supply");

        // 2. Propose a harmful-by-A incentive, pass it with dual majority.
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        address[] memory votersA = new address[](2);
        votersA[0] = alice;
        votersA[1] = avi;
        address[] memory votersB = new address[](2);
        votersB[0] = basma;
        votersB[1] = bilal;
        passProposal(id, votersA, votersB);

        // 3. Confirm an event with 1 A + 1 B + 2 international sources.
        uint64 emailTs = uint64(block.timestamp - 1 hours);
        confirmDefaultEvent(id, emailTs, "checkpoint-event");
        (,,, uint256 planned,,) = d.engine.events(1);
        assertEq(planned, 10e18, "5% of 200 corpus");

        // 4. Ride out the dispute window, finalize, and claim on the B side.
        vm.warp(block.timestamp + 48 hours);
        d.engine.finalize(1);
        assertEq(d.poolA.corpusBalance(), 190e18, "corpus slashed");
        assertEq(d.poolB.claimable(basma), 5e18, "equal per-member share");

        vm.prank(basma);
        uint256 claimed = d.poolB.claim();
        assertEq(claimed, 5e18);

        // Reclaim the quadratically locked vote stake (1 vote -> 1 token).
        vm.prank(basma);
        d.incentives.withdrawVoteStake(id, idNullifier("basma"));
        assertEq(d.tokenB.balanceOf(basma), 905e18, "900 mint - 1 locked + 1 refund + 5 claim");

        // 5. Reserve backing survives the whole trip: every token everywhere is
        //    still redeemable 1:1.
        assertEq(
            d.usd.balanceOf(address(d.minterA)), d.tokenA.totalSupply(), "A reserve = A supply"
        );
        assertEq(
            d.usd.balanceOf(address(d.minterB)), d.tokenB.totalSupply(), "B reserve = B supply"
        );
    }
}

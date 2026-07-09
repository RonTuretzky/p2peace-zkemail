// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BaseTest} from "./Base.t.sol";
import {Community, Direction, SourceCategory} from "../src/Types.sol";
import {IncentiveRegistry} from "../src/IncentiveRegistry.sol";
import {IIncentiveRegistry} from "../src/interfaces/IIncentiveRegistry.sol";

/// @notice Deep coverage of IncentiveRegistry: proposal validation, quadratic
///         voting, dual-majority + quorum finalization, stake withdrawal, and
///         the attestation/engine trigger callbacks.
contract IncentivesTest is BaseTest {
    address internal alice;
    address internal avi;
    address internal basma;
    address internal bilal;

    uint256 internal t0;

    // Redeclared events for vm.expectEmit.
    event Proposed(uint256 indexed id, address indexed proposer, bytes32 patternHash);
    event Voted(
        uint256 indexed id, bytes32 indexed nullifier, Community community, bool support,
        uint256 votes
    );
    event Finalized(uint256 indexed id, bool passed);
    event StakeWithdrawn(uint256 indexed id, bytes32 indexed nullifier, uint256 amount);
    event Triggered(uint256 indexed id, uint16 triggerCount);
    event TriggerReversed(uint256 indexed id, uint16 triggerCount);
    event Wired(address attestation, address engine);

    function setUp() public override {
        super.setUp();
        t0 = block.timestamp;
        alice = makeAddr("alice");
        avi = makeAddr("avi");
        basma = makeAddr("basma");
        bilal = makeAddr("bilal");
        registerAndMint(alice, Community.A, "alice", 1000e18);
        registerAndMint(avi, Community.A, "avi", 1000e18);
        registerAndMint(basma, Community.B, "basma", 1000e18);
        registerAndMint(bilal, Community.B, "bilal", 1000e18);
        // roll: 2 A + 2 B = 4 members, each holding 900e18 community tokens.
    }

    // ------------------------------------------------------------------ helpers

    function _vote(address who, Community c, uint256 id, bool support, uint256 n) internal {
        uint256 cost = n * n * 1e18;
        vm.startPrank(who);
        (c == Community.A ? d.tokenA : d.tokenB).approve(address(d.incentives), cost);
        d.incentives.castVote(id, support, n);
        vm.stopPrank();
    }

    function _warpToVoting(uint256 createdAt) internal {
        vm.warp(createdAt + d.incentives.discussionPeriod());
    }

    function _warpPastVoting(uint256 createdAt) internal {
        vm.warp(createdAt + d.incentives.discussionPeriod() + d.incentives.votingPeriod());
    }

    // ============================================================ propose: happy

    function test_propose_happyPath_storesEverything() public {
        IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByB);

        vm.expectEmit(true, true, false, true, address(d.incentives));
        emit Proposed(1, address(this), NEWS_PATTERN);
        uint256 id = d.incentives.propose(input);

        assertEq(id, 1, "first id");
        assertEq(d.incentives.incentiveCount(), 1);

        IIncentiveRegistry.IncentiveView memory v = d.incentives.getIncentive(id);
        assertEq(v.proposer, address(this));
        assertEq(uint8(v.direction), uint8(Direction.HarmfulByB));
        assertEq(v.patternHash, NEWS_PATTERN);
        assertEq(v.requiredA, 1);
        assertEq(v.requiredB, 1);
        assertEq(v.requiredIntl, 2);
        assertEq(v.attestationWindow, 7 days);
        assertEq(v.redistributionBps, 500);
        assertEq(v.maxTriggers, 3);
        assertEq(v.triggerCooldown, 7 days);
        assertEq(v.triggerCount, 0);
        assertEq(v.lastTriggeredAt, 0);

        assertEq(uint8(d.incentives.sourceCategory(id, NEWS_A1)), uint8(SourceCategory.CommunityA));
        assertEq(uint8(d.incentives.sourceCategory(id, NEWS_B2)), uint8(SourceCategory.CommunityB));
        assertEq(
            uint8(d.incentives.sourceCategory(id, NEWS_I3)), uint8(SourceCategory.International)
        );
        assertEq(uint8(d.incentives.sourceCategory(id, GOV_A)), uint8(SourceCategory.None));

        // Not active until finalized+passed.
        assertFalse(d.incentives.isActive(id));

        // Second proposal gets the next id; source maps are per-id.
        uint256 id2 = d.incentives.propose(defaultProposal(Direction.Joint));
        assertEq(id2, 2);
        assertEq(
            uint8(d.incentives.sourceCategory(id2, NEWS_A1)), uint8(SourceCategory.CommunityA)
        );
    }

    // ======================================================= propose: validation

    function test_propose_revert_zeroPattern() public {
        IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByA);
        input.patternHash = bytes32(0);
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);
    }

    function test_propose_revert_zeroRequireds() public {
        IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByA);
        input.requiredA = 0;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);

        input = defaultProposal(Direction.HarmfulByA);
        input.requiredB = 0;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);

        input = defaultProposal(Direction.HarmfulByA);
        input.requiredIntl = 0;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);
    }

    function test_propose_attestationWindow_bounds() public {
        // Too short: 1 day - 1.
        IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByA);
        input.attestationWindow = 1 days - 1;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);

        // Exactly 1 day is fine.
        input = defaultProposal(Direction.HarmfulByA);
        input.attestationWindow = 1 days;
        uint256 id = d.incentives.propose(input);
        assertEq(d.incentives.getIncentive(id).attestationWindow, 1 days);

        // Too long: 30 days + 1 (cooldown lifted above so only the window fails).
        input = defaultProposal(Direction.HarmfulByA);
        input.attestationWindow = 30 days + 1;
        input.triggerCooldown = 40 days;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);

        // Exactly 30 days is fine.
        input = defaultProposal(Direction.HarmfulByA);
        input.attestationWindow = 30 days;
        input.triggerCooldown = 30 days;
        id = d.incentives.propose(input);
        assertEq(d.incentives.getIncentive(id).attestationWindow, 30 days);
    }

    function test_propose_redistributionBps_bounds() public {
        IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByA);
        input.redistributionBps = 0;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);

        input = defaultProposal(Direction.HarmfulByA);
        input.redistributionBps = 501; // maxRedistributionBps defaults to 500
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);

        // Exactly the cap is fine.
        input = defaultProposal(Direction.HarmfulByA);
        input.redistributionBps = 500;
        uint256 id = d.incentives.propose(input);
        assertEq(d.incentives.getIncentive(id).redistributionBps, 500);
    }

    function test_propose_revert_zeroMaxTriggers() public {
        IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByA);
        input.maxTriggers = 0;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);
    }

    function test_propose_cooldown_vs_window() public {
        // Cooldown one second shorter than the window: rejected.
        IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByA);
        input.triggerCooldown = input.attestationWindow - 1;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);

        // Equal is fine (defaultProposal already has cooldown == window == 7 days).
        input = defaultProposal(Direction.HarmfulByA);
        uint256 id = d.incentives.propose(input);
        assertEq(d.incentives.getIncentive(id).triggerCooldown, 7 days);
    }

    function test_propose_revert_mismatchedArrays() public {
        IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByA);
        SourceCategory[] memory shortCats = new SourceCategory[](6);
        for (uint256 i = 0; i < 6; i++) {
            shortCats[i] = input.categories[i];
        }
        input.categories = shortCats;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);
    }

    function test_propose_revert_noneCategory() public {
        IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByA);
        input.categories[0] = SourceCategory.None;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);
    }

    function test_propose_revert_duplicateDomain() public {
        IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByA);
        input.sourceDomains[1] = input.sourceDomains[0]; // NEWS_A1 twice
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);
    }

    function test_propose_revert_insufficientSourcesPerCategory() public {
        // default supplies 2 A / 2 B / 3 Intl sources.
        IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByA);
        input.requiredA = 3;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);

        input = defaultProposal(Direction.HarmfulByA);
        input.requiredB = 3;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);

        input = defaultProposal(Direction.HarmfulByA);
        input.requiredIntl = 4;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);

        // Requiring exactly what is supplied is fine.
        input = defaultProposal(Direction.HarmfulByA);
        input.requiredA = 2;
        input.requiredB = 2;
        input.requiredIntl = 3;
        d.incentives.propose(input);
    }

    function test_propose_cooldownAfterRejection_exactBoundary() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));

        // Nobody votes -> rejection at finalize.
        _warpPastVoting(t0);
        uint256 finalizedAt = block.timestamp;
        d.incentives.finalize(id);
        assertEq(
            d.incentives.cooldownUntil(address(this)),
            finalizedAt + d.incentives.rejectionCooldown(),
            "30d cooldown stamped"
        );

        // Blocked immediately...
        vm.expectRevert(IncentiveRegistry.ProposerOnCooldown.selector);
        d.incentives.propose(defaultProposal(Direction.HarmfulByA));

        // ...and still blocked one second before the cooldown ends...
        vm.warp(finalizedAt + 30 days - 1);
        vm.expectRevert(IncentiveRegistry.ProposerOnCooldown.selector);
        d.incentives.propose(defaultProposal(Direction.HarmfulByA));

        // ...but exactly at cooldownUntil it goes through.
        vm.warp(finalizedAt + 30 days);
        uint256 id2 = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        assertEq(id2, 2);

        // A different proposer was never on cooldown.
        vm.prank(alice);
        d.incentives.propose(defaultProposal(Direction.HarmfulByA));
    }

    function test_propose_passingProposal_setsNoCooldown() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        address[] memory votersA = new address[](2);
        votersA[0] = alice;
        votersA[1] = avi;
        address[] memory votersB = new address[](2);
        votersB[0] = basma;
        votersB[1] = bilal;
        passProposal(id, votersA, votersB);

        assertEq(d.incentives.cooldownUntil(address(this)), 0, "no cooldown after a pass");
        d.incentives.propose(defaultProposal(Direction.HarmfulByB)); // proposes freely
    }

    // ================================================================== wiring

    function test_wire_onceOnly_andOnlyOwner() public {
        // Deploy script already wired the live registry.
        assertEq(d.incentives.attestation(), address(d.attestation));
        assertEq(d.incentives.engine(), address(d.engine));
        vm.expectRevert(IncentiveRegistry.AlreadyWired.selector);
        d.incentives.wire(makeAddr("att2"), makeAddr("eng2"));

        // Fresh instance: non-owner blocked, owner wires once, second wire reverts.
        IncentiveRegistry fresh = new IncentiveRegistry(
            address(this), d.identity, IERC20(address(d.tokenA)), IERC20(address(d.tokenB))
        );
        address att = makeAddr("att");
        address eng = makeAddr("eng");

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        fresh.wire(att, eng);

        vm.expectEmit(false, false, false, true, address(fresh));
        emit Wired(att, eng);
        fresh.wire(att, eng);
        assertEq(fresh.attestation(), att);
        assertEq(fresh.engine(), eng);

        vm.expectRevert(IncentiveRegistry.AlreadyWired.selector);
        fresh.wire(att, eng);
    }

    // ================================================================ setParams

    function test_setParams_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        d.incentives.setParams(7 days, 3 days, 3000, 500);
    }

    function test_setParams_bounds() public {
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.setParams(1 days - 1, 3 days, 3000, 500);

        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.setParams(7 days, 1 days - 1, 3000, 500);

        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.setParams(7 days, 3 days, 10_001, 500);

        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.setParams(7 days, 3 days, 3000, 2001);

        // All extremes accepted at the boundary.
        d.incentives.setParams(1 days, 1 days, 10_000, 2000);
        assertEq(d.incentives.discussionPeriod(), 1 days);
        assertEq(d.incentives.votingPeriod(), 1 days);
        assertEq(d.incentives.quorumBps(), 10_000);
        assertEq(d.incentives.maxRedistributionBps(), 2000);

        // The raised cap immediately governs proposals.
        IncentiveRegistry.ProposalInput memory input = defaultProposal(Direction.HarmfulByA);
        input.redistributionBps = 2000;
        d.incentives.propose(input);

        input.redistributionBps = 2001;
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.propose(input);
    }

    // =================================================================== voting

    function test_castVote_windowBoundaries() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        uint256 votingStart = t0 + d.incentives.discussionPeriod();
        uint256 votingEnd = votingStart + d.incentives.votingPeriod();

        // One second before discussion ends: not in voting.
        vm.warp(votingStart - 1);
        vm.startPrank(alice);
        d.tokenA.approve(address(d.incentives), 1e18);
        vm.expectRevert(IncentiveRegistry.NotInVoting.selector);
        d.incentives.castVote(id, true, 1);

        // Exactly at votingStart: accepted.
        vm.warp(votingStart);
        d.incentives.castVote(id, true, 1);
        vm.stopPrank();

        // One second before votingEnd: accepted.
        vm.warp(votingEnd - 1);
        _vote(avi, Community.A, id, true, 1);

        // Exactly at votingEnd: rejected.
        vm.warp(votingEnd);
        vm.startPrank(basma);
        d.tokenB.approve(address(d.incentives), 1e18);
        vm.expectRevert(IncentiveRegistry.NotInVoting.selector);
        d.incentives.castVote(id, true, 1);
        vm.stopPrank();
    }

    function test_castVote_revert_nonexistentProposal() public {
        vm.prank(alice);
        vm.expectRevert(IncentiveRegistry.NotInVoting.selector);
        d.incentives.castVote(999, true, 1);
    }

    function test_castVote_revert_notActiveMember() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);

        vm.prank(makeAddr("rando"));
        vm.expectRevert(IncentiveRegistry.NotActiveMember.selector);
        d.incentives.castVote(id, true, 1);
    }

    function test_castVote_revert_expiredMember() public {
        // Membership expires 365 days after enrollment; open a voting window that
        // starts just past alice's expiry.
        vm.warp(t0 + 359 days);
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0 + 359 days); // now = t0 + 366 days > expiry (t0 + 365 days)

        assertFalse(d.identity.isActiveMember(alice));
        vm.prank(alice);
        vm.expectRevert(IncentiveRegistry.NotActiveMember.selector);
        d.incentives.castVote(id, true, 1);
    }

    function test_castVote_revert_zeroVotes() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);

        vm.prank(alice);
        vm.expectRevert(IncentiveRegistry.ZeroVotes.selector);
        d.incentives.castVote(id, true, 0);
    }

    function test_castVote_quadraticLock_pullsSquareTokens() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);

        uint256 aliceBefore = d.tokenA.balanceOf(alice);
        uint256 registryBefore = d.tokenA.balanceOf(address(d.incentives));

        // Approve outside the expectation window: _vote's approve() would emit
        // Approval and get matched against the expected Voted event.
        vm.prank(alice);
        d.tokenA.approve(address(d.incentives), 9e18);
        vm.expectEmit(true, true, false, true, address(d.incentives));
        emit Voted(id, idNullifier("alice"), Community.A, true, 3);
        vm.prank(alice);
        d.incentives.castVote(id, true, 3);

        assertEq(d.tokenA.balanceOf(alice), aliceBefore - 9e18, "3 votes cost 9 tokens");
        assertEq(d.tokenA.balanceOf(address(d.incentives)), registryBefore + 9e18);

        (address voter, Community community, uint256 locked, bool voted, bool refunded) =
            d.incentives.ballots(id, idNullifier("alice"));
        assertEq(voter, alice);
        assertEq(uint8(community), uint8(Community.A));
        assertEq(locked, 9e18);
        assertTrue(voted);
        assertFalse(refunded);

        (uint256 yesA,,,, uint256 participants) = d.incentives.tallies(id);
        assertEq(yesA, 3, "tally counts votes, not tokens");
        assertEq(participants, 1);

        // B-side voter pulls from tokenB, not tokenA.
        uint256 basmaBefore = d.tokenB.balanceOf(basma);
        _vote(basma, Community.B, id, false, 2);
        assertEq(d.tokenB.balanceOf(basma), basmaBefore - 4e18);
        assertEq(d.tokenB.balanceOf(address(d.incentives)), 4e18);
    }

    function test_castVote_revert_alreadyVoted_sameWallet() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);

        _vote(alice, Community.A, id, true, 1);
        vm.prank(alice);
        vm.expectRevert(IncentiveRegistry.AlreadyVoted.selector);
        d.incentives.castVote(id, false, 1);
    }

    function test_castVote_revert_rotatedWallet_sameNullifier() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);

        _vote(alice, Community.A, id, true, 1);

        // Rotate alice's identity (same email nullifier) to a fresh wallet.
        address alice2 = makeAddr("alice2");
        registerMember(alice2, Community.A, "alice");
        assertTrue(d.identity.isActiveMember(alice2));
        assertEq(d.identity.nullifierOf(alice2), idNullifier("alice"));

        // The rotated wallet cannot vote again on the same proposal.
        vm.prank(alice2);
        vm.expectRevert(IncentiveRegistry.AlreadyVoted.selector);
        d.incentives.castVote(id, false, 1);
    }

    function test_castVote_talliesPerCommunity() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);

        _vote(alice, Community.A, id, true, 3);
        _vote(avi, Community.A, id, false, 2);
        _vote(basma, Community.B, id, true, 4);
        _vote(bilal, Community.B, id, false, 1);

        (uint256 yesA, uint256 noA, uint256 yesB, uint256 noB, uint256 participants) =
            d.incentives.tallies(id);
        assertEq(yesA, 3);
        assertEq(noA, 2);
        assertEq(yesB, 4);
        assertEq(noB, 1);
        assertEq(participants, 4);

        // Locked balances: 9 + 4 in tokenA, 16 + 1 in tokenB.
        assertEq(d.tokenA.balanceOf(address(d.incentives)), 13e18);
        assertEq(d.tokenB.balanceOf(address(d.incentives)), 17e18);
    }

    // ================================================================= finalize

    function test_finalize_revert_votingNotOver_exactBoundary() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);
        _vote(alice, Community.A, id, true, 1);
        _vote(basma, Community.B, id, true, 1);

        uint256 end = t0 + d.incentives.discussionPeriod() + d.incentives.votingPeriod();
        vm.warp(end - 1);
        vm.expectRevert(IncentiveRegistry.VotingNotOver.selector);
        d.incentives.finalize(id);

        vm.warp(end);
        vm.expectEmit(true, false, false, true, address(d.incentives));
        emit Finalized(id, true);
        d.incentives.finalize(id);
        assertTrue(d.incentives.isActive(id));
    }

    function test_finalize_revert_alreadyFinalized() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpPastVoting(t0);
        d.incentives.finalize(id);
        vm.expectRevert(IncentiveRegistry.AlreadyFinalized.selector);
        d.incentives.finalize(id);
    }

    function test_finalize_revert_nonexistent() public {
        vm.expectRevert(IncentiveRegistry.BadProposal.selector);
        d.incentives.finalize(42);
    }

    function test_finalize_dualMajorityMatrix() public {
        // Propose all three up front (a rejection later puts this proposer on
        // cooldown, so no proposing after the first failing finalize).
        uint256 bothYes = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        uint256 aYesBNo = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        uint256 tieInA = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);

        // bothYes: unanimous.
        _vote(alice, Community.A, bothYes, true, 1);
        _vote(avi, Community.A, bothYes, true, 1);
        _vote(basma, Community.B, bothYes, true, 1);
        _vote(bilal, Community.B, bothYes, true, 1);

        // aYesBNo: A approves, B rejects.
        _vote(alice, Community.A, aYesBNo, true, 1);
        _vote(avi, Community.A, aYesBNo, true, 1);
        _vote(basma, Community.B, aYesBNo, false, 1);
        _vote(bilal, Community.B, aYesBNo, false, 1);

        // tieInA: yesA == noA (a tie is not a majority), B approves.
        _vote(alice, Community.A, tieInA, true, 1);
        _vote(avi, Community.A, tieInA, false, 1);
        _vote(basma, Community.B, tieInA, true, 1);
        _vote(bilal, Community.B, tieInA, true, 1);

        _warpPastVoting(t0);
        d.incentives.finalize(bothYes);
        d.incentives.finalize(aYesBNo);
        d.incentives.finalize(tieInA);

        assertTrue(d.incentives.isActive(bothYes), "dual yes passes");
        assertFalse(d.incentives.isActive(aYesBNo), "one community vetoes");
        assertFalse(d.incentives.isActive(tieInA), "tie is not a majority");
    }

    function test_finalize_quorumExactBoundary() public {
        // Grow the roll to 10 members: quorum 30% -> participants*10000 >= 30000,
        // i.e. exactly 3 voters pass, 2 fall one short.
        registerMember(makeAddr("a3"), Community.A, "a3");
        registerMember(makeAddr("a4"), Community.A, "a4");
        registerMember(makeAddr("a5"), Community.A, "a5");
        registerMember(makeAddr("b3"), Community.B, "b3");
        registerMember(makeAddr("b4"), Community.B, "b4");
        registerMember(makeAddr("b5"), Community.B, "b5");
        assertEq(d.identity.totalMembers(), 10);

        uint256 atQuorum = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        uint256 oneShort = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);

        // atQuorum: 3 participants, both majorities yes.
        _vote(alice, Community.A, atQuorum, true, 1);
        _vote(avi, Community.A, atQuorum, true, 1);
        _vote(basma, Community.B, atQuorum, true, 1);

        // oneShort: 2 participants, both majorities yes - quorum is the only miss.
        _vote(alice, Community.A, oneShort, true, 1);
        _vote(basma, Community.B, oneShort, true, 1);

        _warpPastVoting(t0);
        d.incentives.finalize(atQuorum);
        d.incentives.finalize(oneShort);

        assertTrue(d.incentives.isActive(atQuorum), "participants*1e4 == quorum*roll passes");
        assertFalse(d.incentives.isActive(oneShort), "one voter short of quorum fails");
    }

    // ======================================================== withdrawVoteStake

    function test_withdraw_revert_notFinalized() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);
        _vote(alice, Community.A, id, true, 2);

        vm.prank(alice);
        vm.expectRevert(IncentiveRegistry.NotFinalized.selector);
        d.incentives.withdrawVoteStake(id, idNullifier("alice"));
    }

    function test_withdraw_refundsExactLock_winOrLose() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);
        _vote(alice, Community.A, id, true, 3); // locks 9e18
        _vote(basma, Community.B, id, false, 2); // locks 4e18, losing side
        _warpPastVoting(t0);
        d.incentives.finalize(id); // fails quorum/majority - irrelevant to refunds

        uint256 aliceBefore = d.tokenA.balanceOf(alice);
        vm.expectEmit(true, true, false, true, address(d.incentives));
        emit StakeWithdrawn(id, idNullifier("alice"), 9e18);
        vm.prank(alice);
        d.incentives.withdrawVoteStake(id, idNullifier("alice"));
        assertEq(d.tokenA.balanceOf(alice), aliceBefore + 9e18, "exact quadratic lock back");
        assertEq(d.tokenA.balanceOf(address(d.incentives)), 0, "registry drained on A side");

        uint256 basmaBefore = d.tokenB.balanceOf(basma);
        vm.prank(basma);
        d.incentives.withdrawVoteStake(id, idNullifier("basma"));
        assertEq(d.tokenB.balanceOf(basma), basmaBefore + 4e18, "losing voters refunded too");

        (,,,, bool refunded) = d.incentives.ballots(id, idNullifier("alice"));
        assertTrue(refunded);
    }

    function test_withdraw_revert_nothingToWithdraw_variants() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);
        _vote(alice, Community.A, id, true, 1);
        _warpPastVoting(t0);
        d.incentives.finalize(id);

        // (a) nullifier that never voted
        vm.prank(alice);
        vm.expectRevert(IncentiveRegistry.NothingToWithdraw.selector);
        d.incentives.withdrawVoteStake(id, idNullifier("never-voted"));

        // (b) caller is not the recorded voter
        vm.prank(basma);
        vm.expectRevert(IncentiveRegistry.NothingToWithdraw.selector);
        d.incentives.withdrawVoteStake(id, idNullifier("alice"));

        // (c) double withdraw
        vm.prank(alice);
        d.incentives.withdrawVoteStake(id, idNullifier("alice"));
        vm.prank(alice);
        vm.expectRevert(IncentiveRegistry.NothingToWithdraw.selector);
        d.incentives.withdrawVoteStake(id, idNullifier("alice"));
    }

    function test_withdraw_afterWalletRotation_paysRecordedVoter() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);
        _vote(alice, Community.A, id, true, 2); // 4e18 locked
        _warpPastVoting(t0);
        d.incentives.finalize(id);

        // Rotate the identity to a new wallet after finalization.
        address alice2 = makeAddr("alice2");
        registerMember(alice2, Community.A, "alice");
        assertEq(d.identity.nullifierOf(alice), bytes32(0), "old wallet wiped");

        // The new wallet is NOT the recorded voter - it cannot take the stake.
        vm.prank(alice2);
        vm.expectRevert(IncentiveRegistry.NothingToWithdraw.selector);
        d.incentives.withdrawVoteStake(id, idNullifier("alice"));

        // The old wallet withdraws via the explicit nullifier even though its
        // membership record is gone.
        uint256 before = d.tokenA.balanceOf(alice);
        vm.prank(alice);
        d.incentives.withdrawVoteStake(id, idNullifier("alice"));
        assertEq(d.tokenA.balanceOf(alice), before + 4e18);
    }

    function test_withdraw_worksForExpiredMembers() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));
        _warpToVoting(t0);
        _vote(alice, Community.A, id, true, 1);
        _warpPastVoting(t0);
        d.incentives.finalize(id);

        // Let the membership lapse entirely.
        vm.warp(t0 + 400 days);
        assertFalse(d.identity.isActiveMember(alice));

        uint256 before = d.tokenA.balanceOf(alice);
        vm.prank(alice);
        d.incentives.withdrawVoteStake(id, idNullifier("alice"));
        assertEq(d.tokenA.balanceOf(alice), before + 1e18);
    }

    // ==================================================== onTriggered/onReversed

    function test_onTriggered_accessAndBookkeeping() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));

        vm.prank(makeAddr("intruder"));
        vm.expectRevert(IncentiveRegistry.NotAttestation.selector);
        d.incentives.onTriggered(id);

        // Even the engine may not bump triggers.
        vm.prank(address(d.engine));
        vm.expectRevert(IncentiveRegistry.NotAttestation.selector);
        d.incentives.onTriggered(id);

        vm.warp(t0 + 12345);
        vm.expectEmit(true, false, false, true, address(d.incentives));
        emit Triggered(id, 1);
        vm.prank(address(d.attestation));
        d.incentives.onTriggered(id);

        IIncentiveRegistry.IncentiveView memory v = d.incentives.getIncentive(id);
        assertEq(v.triggerCount, 1);
        assertEq(v.lastTriggeredAt, uint64(t0 + 12345));
    }

    function test_onReversed_accessAndFloorAtZero() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA));

        vm.prank(makeAddr("intruder"));
        vm.expectRevert(IncentiveRegistry.NotEngine.selector);
        d.incentives.onReversed(id);

        // Even the attestation contract may not reverse.
        vm.prank(address(d.attestation));
        vm.expectRevert(IncentiveRegistry.NotEngine.selector);
        d.incentives.onReversed(id);

        // Reversal at zero does not underflow.
        vm.expectEmit(true, false, false, true, address(d.incentives));
        emit TriggerReversed(id, 0);
        vm.prank(address(d.engine));
        d.incentives.onReversed(id);
        assertEq(d.incentives.getIncentive(id).triggerCount, 0);

        // Trigger twice, reverse once -> net 1.
        vm.startPrank(address(d.attestation));
        d.incentives.onTriggered(id);
        d.incentives.onTriggered(id);
        vm.stopPrank();
        vm.prank(address(d.engine));
        d.incentives.onReversed(id);
        assertEq(d.incentives.getIncentive(id).triggerCount, 1);
    }

    function test_isActive_falseAtMaxTriggers_reversalReactivates() public {
        uint256 id = d.incentives.propose(defaultProposal(Direction.HarmfulByA)); // maxTriggers 3
        address[] memory votersA = new address[](2);
        votersA[0] = alice;
        votersA[1] = avi;
        address[] memory votersB = new address[](2);
        votersB[0] = basma;
        votersB[1] = bilal;
        passProposal(id, votersA, votersB);
        assertTrue(d.incentives.isActive(id));

        vm.startPrank(address(d.attestation));
        d.incentives.onTriggered(id);
        d.incentives.onTriggered(id);
        assertTrue(d.incentives.isActive(id), "still active at 2/3");
        d.incentives.onTriggered(id);
        vm.stopPrank();
        assertFalse(d.incentives.isActive(id), "exhausted at 3/3");

        // Council reversal frees a slot again.
        vm.prank(address(d.engine));
        d.incentives.onReversed(id);
        assertTrue(d.incentives.isActive(id), "2/3 after reversal");
    }
}

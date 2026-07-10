// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {Community, EmailProof} from "../src/Types.sol";
import {PeaceToken} from "../src/PeaceToken.sol";
import {PeaceMinter} from "../src/PeaceMinter.sol";
import {CommunityPool} from "../src/CommunityPool.sol";
import {Treasury} from "../src/Treasury.sol";
import {ICommunityPool} from "../src/interfaces/ICommunityPool.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

/// @notice Economy module: PeaceToken issuance control, PeaceMinter reserve-backed
///         mint/redeem paths, CommunityPool corpus/reward accounting, Treasury flows.
contract EconomyTest is BaseTest {
    address internal rando = makeAddr("rando");

    // ------------------------------------------------------------------ helpers

    /// @dev The load-bearing invariant of the whole economy: the minter's USD
    ///      reserve exactly backs every token in existence.
    function assertReserve(Community c) internal view {
        if (c == Community.A) {
            assertEq(
                d.usd.balanceOf(address(d.minterA)), d.tokenA.totalSupply(), "A reserve = supply"
            );
        } else {
            assertEq(
                d.usd.balanceOf(address(d.minterB)), d.tokenB.totalSupply(), "B reserve = supply"
            );
        }
    }

    /// @dev Fund `who` with mUSD approved for `spender`.
    function fund(address who, address spender, uint256 amount) internal {
        mintUsd(who, amount);
        vm.prank(who);
        d.usd.approve(spender, amount);
    }

    // =========================================================== PeaceToken

    function test_token_mintOnlyMinter() public {
        // Neither a random address nor the owner (this test contract) may mint.
        vm.prank(rando);
        vm.expectRevert(PeaceToken.NotMinter.selector);
        d.tokenA.mint(rando, 1e18);

        vm.expectRevert(PeaceToken.NotMinter.selector);
        d.tokenA.mint(address(this), 1e18);

        // The wired minter can.
        vm.prank(address(d.minterA));
        d.tokenA.mint(rando, 5e18);
        assertEq(d.tokenA.balanceOf(rando), 5e18);
    }

    function test_token_burnOnlyMinter() public {
        vm.prank(address(d.minterA));
        d.tokenA.mint(rando, 5e18);

        vm.prank(rando);
        vm.expectRevert(PeaceToken.NotMinter.selector);
        d.tokenA.burn(rando, 1e18);

        vm.expectRevert(PeaceToken.NotMinter.selector);
        d.tokenA.burn(rando, 1e18);

        vm.prank(address(d.minterA));
        d.tokenA.burn(rando, 5e18);
        assertEq(d.tokenA.balanceOf(rando), 0);
        assertEq(d.tokenA.totalSupply(), 0);
    }

    function test_token_setMinterOnceAndOnlyOwner() public {
        // Deployed tokens already have their minter wired: setting again reverts.
        vm.expectRevert(PeaceToken.MinterAlreadySet.selector);
        d.tokenA.setMinter(rando);

        // Fresh token: non-owner cannot set.
        PeaceToken fresh = new PeaceToken("Fresh", "FRSH", Community.B, address(this));
        assertEq(uint8(fresh.community()), uint8(Community.B));
        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, rando));
        fresh.setMinter(rando);

        // Owner sets once; the new minter works; a second set reverts.
        fresh.setMinter(rando);
        assertEq(fresh.minter(), rando);
        vm.prank(rando);
        fresh.mint(rando, 1e18);
        assertEq(fresh.balanceOf(rando), 1e18);

        vm.expectRevert(PeaceToken.MinterAlreadySet.selector);
        fresh.setMinter(address(this));
    }

    // =========================================================== PeaceMinter

    function test_mintCitizen_splitAndReserveInvariant() public {
        address alice = makeAddr("alice");
        registerMember(alice, Community.A, "alice");
        fund(alice, address(d.minterA), 1000e18);

        vm.prank(alice);
        d.minterA.mintCitizen(1000e18);

        assertEq(d.tokenA.balanceOf(alice), 900e18, "90% to citizen");
        assertEq(d.tokenA.balanceOf(address(d.poolA)), 100e18, "10% minted to pool");
        assertEq(d.poolA.corpusBalance(), 100e18, "stake booked as corpus");
        assertEq(d.tokenA.totalSupply(), 1000e18);
        assertReserve(Community.A);

        // Second mint with an odd amount: stake floor-rounds, invariant still exact.
        fund(alice, address(d.minterA), 333);
        vm.prank(alice);
        d.minterA.mintCitizen(333);
        assertEq(d.poolA.corpusBalance(), 100e18 + 33, "floor(333 * 10%)");
        assertEq(d.tokenA.balanceOf(alice), 900e18 + 300);
        assertReserve(Community.A);

        // Redeem 1:1 keeps the invariant too.
        vm.prank(alice);
        d.minterA.redeem(400e18);
        assertEq(d.usd.balanceOf(alice), 400e18);
        assertReserve(Community.A);
    }

    function test_mintCitizen_notCitizen_unregistered() public {
        fund(rando, address(d.minterA), 100e18);
        vm.prank(rando);
        vm.expectRevert(PeaceMinter.NotCitizen.selector);
        d.minterA.mintCitizen(100e18);
    }

    function test_mintCitizen_notCitizen_expired_boundary() public {
        address alice = makeAddr("alice");
        registerMember(alice, Community.A, "alice");
        (,,, uint64 expiresAt) = d.identity.members(alice);
        fund(alice, address(d.minterA), 200e18);

        // Exactly at expiry the membership is still active (<= check).
        vm.warp(expiresAt);
        vm.prank(alice);
        d.minterA.mintCitizen(100e18);
        assertEq(d.tokenA.balanceOf(alice), 90e18);
        assertReserve(Community.A);

        // One second past expiry it is not.
        vm.warp(uint256(expiresAt) + 1);
        vm.prank(alice);
        vm.expectRevert(PeaceMinter.NotCitizen.selector);
        d.minterA.mintCitizen(100e18);
    }

    function test_mintCitizen_notCitizen_otherCommunity() public {
        address basma = makeAddr("basma");
        registerMember(basma, Community.B, "basma");
        fund(basma, address(d.minterA), 100e18);
        vm.prank(basma);
        vm.expectRevert(PeaceMinter.NotCitizen.selector);
        d.minterA.mintCitizen(100e18);
    }

    function test_mintOutsider_premiumMathAndReserve() public {
        // Default premium 2x: tokens = usd/2, the other half funds the Treasury.
        fund(rando, address(d.minterA), 100e18);
        vm.prank(rando);
        d.minterA.mintOutsider(100e18);

        assertEq(d.tokenA.balanceOf(rando), 50e18, "tokens = usd / 2");
        assertEq(d.treasury.balance(), 50e18, "premium to treasury");
        assertReserve(Community.A);

        // Odd wei amount: tokens floor-round, the treasury absorbs the dust, and
        // the reserve invariant stays exact.
        fund(rando, address(d.minterA), 101);
        vm.prank(rando);
        d.minterA.mintOutsider(101);
        assertEq(d.tokenA.balanceOf(rando), 50e18 + 50, "floor(101/2)");
        assertEq(d.treasury.balance(), 50e18 + 51);
        assertReserve(Community.A);

        // 5x premium: tokens = usd/5.
        d.minterA.setParams(1_000, 50_000);
        fund(rando, address(d.minterA), 100e18);
        vm.prank(rando);
        d.minterA.mintOutsider(100e18);
        assertEq(d.tokenA.balanceOf(rando), 50e18 + 50 + 20e18, "tokens = usd / 5");
        assertEq(d.treasury.balance(), 50e18 + 51 + 80e18);
        assertReserve(Community.A);
    }

    function test_mintOutsider_noPremiumAtPar() public {
        d.minterA.setParams(1_000, 10_000); // 1x: outsiders mint at par
        fund(rando, address(d.minterA), 100e18);
        vm.prank(rando);
        d.minterA.mintOutsider(100e18);
        assertEq(d.tokenA.balanceOf(rando), 100e18);
        assertEq(d.treasury.balance(), 0, "no premium at 1x");
        assertReserve(Community.A);
    }

    function test_mintOutsider_citizenMustUseCitizenMint() public {
        address alice = makeAddr("alice");
        registerMember(alice, Community.A, "alice");
        fund(alice, address(d.minterA), 100e18);
        vm.prank(alice);
        vm.expectRevert(PeaceMinter.CitizenMustUseCitizenMint.selector);
        d.minterA.mintOutsider(100e18);
    }

    function test_mintOutsider_crossCommunityCitizenAllowed() public {
        // An A citizen is an outsider to community B: allowed, pays the premium.
        address alice = makeAddr("alice");
        registerMember(alice, Community.A, "alice");
        fund(alice, address(d.minterB), 100e18);
        vm.prank(alice);
        d.minterB.mintOutsider(100e18);
        assertEq(d.tokenB.balanceOf(alice), 50e18);
        assertEq(d.treasury.balance(), 50e18);
        assertReserve(Community.B);
    }

    function test_redeem_anyoneOneToOne() public {
        address alice = makeAddr("alice");
        registerAndMint(alice, Community.A, "alice", 1000e18);

        // Tokens transferred to a non-member are still redeemable 1:1.
        vm.prank(alice);
        d.tokenA.transfer(rando, 100e18);
        vm.prank(rando);
        d.minterA.redeem(100e18);
        assertEq(d.usd.balanceOf(rando), 100e18);
        assertEq(d.tokenA.balanceOf(rando), 0);
        assertReserve(Community.A);

        // Redeeming more than you hold reverts in the burn.
        vm.prank(rando);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, rando, 0, 1)
        );
        d.minterA.redeem(1);
    }

    function test_mintAtPar_onlyParMinters() public {
        fund(address(this), address(d.minterA), 100e18);
        vm.expectRevert(PeaceMinter.NotParMinter.selector);
        d.minterA.mintAtPar(100e18);

        // setParMinter is owner-gated.
        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, rando));
        d.minterA.setParMinter(rando, true);

        // Need a member so the reward is distributed rather than buffered.
        address alice = makeAddr("alice");
        registerMember(alice, Community.A, "alice");

        d.minterA.setParMinter(address(this), true);
        d.minterA.mintAtPar(100e18);
        assertEq(d.tokenA.balanceOf(address(d.poolA)), 100e18, "minted into pool");
        assertEq(d.poolA.corpusBalance(), 0, "rewards are not corpus");
        assertEq(d.poolA.claimable(alice), 100e18, "sole member claims it all");
        assertReserve(Community.A);

        // Revoking the flag closes the door again.
        d.minterA.setParMinter(address(this), false);
        fund(address(this), address(d.minterA), 1e18);
        vm.expectRevert(PeaceMinter.NotParMinter.selector);
        d.minterA.mintAtPar(1e18);
    }

    function test_setParams_boundsAndAccess() public {
        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, rando));
        d.minterA.setParams(1_000, 20_000);

        // Each bound, one wei past the edge.
        vm.expectRevert(PeaceMinter.BadParams.selector);
        d.minterA.setParams(2_001, 20_000); // stake > 20%

        vm.expectRevert(PeaceMinter.BadParams.selector);
        d.minterA.setParams(1_000, 9_999); // premium < 1x

        vm.expectRevert(PeaceMinter.BadParams.selector);
        d.minterA.setParams(1_000, 50_001); // premium > 5x

        // Exact edges are legal.
        d.minterA.setParams(2_000, 10_000);
        assertEq(d.minterA.poolBps(), 2_000);
        assertEq(d.minterA.premiumBps(), 10_000);
        d.minterA.setParams(0, 50_000);
        assertEq(d.minterA.poolBps(), 0);
        assertEq(d.minterA.premiumBps(), 50_000);
    }

    function test_poolBpsZero_noStakeNoNotify() public {
        d.minterA.setParams(0, 20_000);
        address alice = makeAddr("alice");
        registerMember(alice, Community.A, "alice");
        fund(alice, address(d.minterA), 100e18);

        // notifyStake must not be called at all when the stake slice is zero.
        vm.expectCall(
            address(d.poolA), abi.encodeWithSelector(ICommunityPool.notifyStake.selector), 0
        );
        vm.prank(alice);
        d.minterA.mintCitizen(100e18);

        assertEq(d.tokenA.balanceOf(alice), 100e18, "everything to the citizen");
        assertEq(d.tokenA.balanceOf(address(d.poolA)), 0);
        assertEq(d.poolA.corpusBalance(), 0);
        assertReserve(Community.A);
    }

    // ========================================================= CommunityPool

    function test_pool_accessControl() public {
        vm.startPrank(rando);
        vm.expectRevert(CommunityPool.NotMinter.selector);
        d.poolA.notifyStake(1e18);
        vm.expectRevert(CommunityPool.NotMinter.selector);
        d.poolA.notifyReward(1e18);
        vm.expectRevert(CommunityPool.NotEngine.selector);
        d.poolA.slashCorpus(1e18);
        vm.expectRevert(CommunityPool.NotRegistry.selector);
        d.poolA.initMember(bytes32(uint256(1)));
        vm.stopPrank();

        // The minter itself cannot slash and the engine cannot notifyStake.
        vm.prank(address(d.minterA));
        vm.expectRevert(CommunityPool.NotEngine.selector);
        d.poolA.slashCorpus(1e18);
        vm.prank(address(d.engine));
        vm.expectRevert(CommunityPool.NotMinter.selector);
        d.poolA.notifyStake(1e18);

        // The engine IS allowed to notifyReward (accounting-only call here).
        vm.prank(address(d.engine));
        d.poolA.notifyReward(0);

        // The registry IS allowed to initMember.
        vm.prank(address(d.identity));
        d.poolA.initMember(bytes32(uint256(1)));

        // wire() is one-shot and owner-gated.
        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, rando));
        d.poolA.wire(rando, rando);
        vm.expectRevert(CommunityPool.AlreadyWired.selector);
        d.poolA.wire(rando, rando);
    }

    function test_pool_equalPerMemberSplit() public {
        address basma = makeAddr("basma");
        address bilal = makeAddr("bilal");
        registerMember(basma, Community.B, "basma");
        registerMember(bilal, Community.B, "bilal");

        d.minterB.setParMinter(address(this), true);
        fund(address(this), address(d.minterB), 100e18);
        d.minterB.mintAtPar(100e18);

        assertEq(d.poolB.claimable(basma), 50e18, "half each");
        assertEq(d.poolB.claimable(bilal), 50e18, "half each");

        vm.prank(basma);
        uint256 got = d.poolB.claim();
        assertEq(got, 50e18);
        assertEq(d.tokenB.balanceOf(basma), 50e18);
        assertEq(d.poolB.claimable(basma), 0, "checkpoint advanced");

        // A second inflow accrues to both again; bilal's first share is intact.
        fund(address(this), address(d.minterB), 30e18);
        d.minterB.mintAtPar(30e18);
        assertEq(d.poolB.claimable(basma), 15e18);
        assertEq(d.poolB.claimable(bilal), 65e18, "50 + 15 rolled up");

        vm.prank(bilal);
        assertEq(d.poolB.claim(), 65e18);
        assertEq(d.tokenB.balanceOf(bilal), 65e18);
        assertReserve(Community.B);
    }

    function test_pool_lateEnrolleeClaimsZeroOfEarlierInflow() public {
        address basma = makeAddr("basma");
        registerMember(basma, Community.B, "basma");

        d.minterB.setParMinter(address(this), true);
        fund(address(this), address(d.minterB), 90e18);
        d.minterB.mintAtPar(90e18);

        // Enrolls after the inflow: checkpoint snapshots the accumulator.
        address bilal = makeAddr("bilal");
        registerMember(bilal, Community.B, "bilal");
        assertEq(d.poolB.claimable(bilal), 0, "no claim on pre-enrollment inflow");
        assertEq(d.poolB.claimable(basma), 90e18);

        vm.prank(bilal);
        assertEq(d.poolB.claim(), 0, "claim() agrees with claimable()");

        // Next inflow splits across the now-2 members.
        fund(address(this), address(d.minterB), 40e18);
        d.minterB.mintAtPar(40e18);
        assertEq(d.poolB.claimable(bilal), 20e18);
        assertEq(d.poolB.claimable(basma), 110e18);
    }

    function test_pool_bufferWhenNoMembers() public {
        // Fresh deploy: community B has zero members. A reward inflow lands in the
        // buffer instead of dividing by zero / vanishing.
        assertEq(d.identity.memberCount(Community.B), 0);
        d.minterB.setParMinter(address(this), true);
        fund(address(this), address(d.minterB), 60e18);
        d.minterB.mintAtPar(60e18);

        assertEq(d.poolB.pendingBuffer(), 60e18, "buffered");
        assertEq(d.poolB.accRewardPerMember(), 0, "accumulator untouched");

        // First member enrolls; the buffer folds into the NEXT inflow and the
        // member - whose checkpoint is 0 - receives all of it.
        address basma = makeAddr("basma");
        registerMember(basma, Community.B, "basma");
        assertEq(d.poolB.claimable(basma), 0, "buffer not released yet");

        fund(address(this), address(d.minterB), 40e18);
        d.minterB.mintAtPar(40e18);
        assertEq(d.poolB.pendingBuffer(), 0, "buffer drained");
        assertEq(d.poolB.claimable(basma), 100e18, "60 buffered + 40 fresh");

        vm.prank(basma);
        assertEq(d.poolB.claim(), 100e18);
        assertEq(d.tokenB.balanceOf(basma), 100e18);
        assertReserve(Community.B);
    }

    function test_pool_claimRequiresActiveMember_renewalRestores() public {
        address basma = makeAddr("basma");
        registerMember(basma, Community.B, "basma");
        (,,, uint64 expiresAt) = d.identity.members(basma);

        d.minterB.setParMinter(address(this), true);
        fund(address(this), address(d.minterB), 70e18);
        d.minterB.mintAtPar(70e18);

        // Exactly at expiry: still active, claimable visible - but don't claim yet.
        vm.warp(expiresAt);
        assertEq(d.poolB.claimable(basma), 70e18);

        // One second later: lapsed. claim reverts, claimable reads 0.
        vm.warp(uint256(expiresAt) + 1);
        assertEq(d.poolB.claimable(basma), 0);
        vm.prank(basma);
        vm.expectRevert(CommunityPool.NotActiveMember.selector);
        d.poolB.claim();

        // Renewal with a fresh proof re-enables the claim; the reward is keyed by
        // nullifier so nothing was lost while lapsed.
        EmailProof memory p =
            mkProof(GOV_B, CITIZENSHIP_PATTERN, idNullifier("basma"), uint64(block.timestamp));
        d.identity.register(p, basma);
        assertEq(d.poolB.claimable(basma), 70e18, "rewards survived the lapse");
        vm.prank(basma);
        assertEq(d.poolB.claim(), 70e18);
    }

    function test_pool_walletRotationKeepsRewards() public {
        address basma = makeAddr("basma");
        registerMember(basma, Community.B, "basma");

        d.minterB.setParMinter(address(this), true);
        fund(address(this), address(d.minterB), 25e18);
        d.minterB.mintAtPar(25e18);
        assertEq(d.poolB.claimable(basma), 25e18);

        // Rotate the same email account (same nullifier) onto a new wallet.
        vm.warp(block.timestamp + 1 days);
        address basma2 = makeAddr("basma2");
        EmailProof memory p =
            mkProof(GOV_B, CITIZENSHIP_PATTERN, idNullifier("basma"), uint64(block.timestamp));
        d.identity.register(p, basma2);

        // Old wallet is out; unclaimed rewards followed the nullifier.
        assertEq(d.poolB.claimable(basma), 0);
        vm.prank(basma);
        vm.expectRevert(CommunityPool.NotActiveMember.selector);
        d.poolB.claim();

        assertEq(d.poolB.claimable(basma2), 25e18, "rewards follow the nullifier");
        vm.prank(basma2);
        assertEq(d.poolB.claim(), 25e18);
        assertEq(d.tokenB.balanceOf(basma2), 25e18);

        // memberCount unchanged by rotation: no reward dilution ghosts.
        assertEq(d.identity.memberCount(Community.B), 1);
    }

    function test_pool_slashCapping() public {
        address alice = makeAddr("alice");
        registerAndMint(alice, Community.A, "alice", 1000e18); // corpus = 100e18

        // Partial slash moves exactly what was asked.
        vm.prank(address(d.engine));
        uint256 actual = d.poolA.slashCorpus(30e18);
        assertEq(actual, 30e18);
        assertEq(d.poolA.corpusBalance(), 70e18);
        assertEq(d.tokenA.balanceOf(address(d.engine)), 30e18);

        // Over-ask is capped at the remaining corpus.
        vm.prank(address(d.engine));
        actual = d.poolA.slashCorpus(500e18);
        assertEq(actual, 70e18, "capped at corpus");
        assertEq(d.poolA.corpusBalance(), 0);
        assertEq(d.tokenA.balanceOf(address(d.engine)), 100e18);

        // Corpus empty: further slashes are 0, not reverts.
        vm.prank(address(d.engine));
        assertEq(d.poolA.slashCorpus(1), 0);
    }

    function test_pool_claimableMatchesClaim_andNonMemberReadsZero() public {
        assertEq(d.poolB.claimable(rando), 0, "non-member reads zero");

        address basma = makeAddr("basma");
        address bilal = makeAddr("bilal");
        address botan = makeAddr("botan");
        registerMember(basma, Community.B, "basma");
        registerMember(bilal, Community.B, "bilal");
        registerMember(botan, Community.B, "botan");

        // 100e18 / 3 does not divide evenly - the view must equal the claim.
        d.minterB.setParMinter(address(this), true);
        fund(address(this), address(d.minterB), 100e18);
        d.minterB.mintAtPar(100e18);

        uint256 view_ = d.poolB.claimable(basma);
        vm.prank(basma);
        uint256 claimed = d.poolB.claim();
        assertEq(claimed, view_, "claimable() == claim()");
        assertEq(d.tokenB.balanceOf(basma), claimed);

        // Double claim yields zero.
        vm.prank(basma);
        assertEq(d.poolB.claim(), 0);
    }

    // ============================================================== Treasury

    function test_treasury_releaseOnlySpenders() public {
        mintUsd(address(d.treasury), 100e18);

        vm.prank(rando);
        vm.expectRevert(Treasury.NotSpender.selector);
        d.treasury.release(rando, 1e18);

        // The engine is wired as a spender at deploy.
        vm.prank(address(d.engine));
        d.treasury.release(rando, 40e18);
        assertEq(d.usd.balanceOf(rando), 40e18);
        assertEq(d.treasury.balance(), 60e18);

        // Grant and revoke round-trip.
        d.treasury.setSpender(address(this), true);
        d.treasury.release(rando, 10e18);
        assertEq(d.treasury.balance(), 50e18);
        d.treasury.setSpender(address(this), false);
        vm.expectRevert(Treasury.NotSpender.selector);
        d.treasury.release(rando, 1e18);
    }

    function test_treasury_donatePullsFundsAndBalance() public {
        assertEq(d.treasury.balance(), 0);
        fund(address(this), address(d.treasury), 55e18);
        d.treasury.donate(55e18);
        assertEq(d.treasury.balance(), 55e18);
        assertEq(d.usd.balanceOf(address(this)), 0, "pulled from donor");

        // No allowance -> the transferFrom inside donate reverts.
        vm.prank(rando);
        vm.expectRevert();
        d.treasury.donate(1e18);
    }

    function test_treasury_setSpenderOnlyOwner() public {
        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, rando));
        d.treasury.setSpender(rando, true);
    }
}

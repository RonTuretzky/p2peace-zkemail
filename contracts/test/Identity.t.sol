// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BaseTest} from "./Base.t.sol";
import {Community, EmailProof} from "../src/Types.sol";
import {DKIMRegistry} from "../src/DKIMRegistry.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {IGroth16Verifier} from "../src/interfaces/IGroth16Verifier.sol";
import {ICommunityPool} from "../src/interfaces/ICommunityPool.sol";

/// @notice Deep coverage of the identity stack: DKIMRegistry key lifecycle,
///         ZKEmailVerifier routing/public-input wiring, IdentityRegistry
///         enrollment, renewal, rotation, replay and freshness rules.
contract IdentityTest is BaseTest {
    address internal stranger = makeAddr("stranger");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint64 internal constant T0 = 1_700_000_000;

    bytes32 internal constant TEST_DOMAIN = keccak256("windows.example");
    bytes32 internal constant TEST_KEY = keccak256("windows-key");

    // =========================================================== DKIMRegistry

    function test_dkim_setKey_ownerOnly() public {
        // Owner (this test contract) can set.
        d.dkim.setKey(TEST_DOMAIN, TEST_KEY, 100, 200);
        (bool exists, uint64 validFrom, uint64 validUntil, uint64 revokedAt) =
            d.dkim.keys(TEST_DOMAIN, TEST_KEY);
        assertTrue(exists);
        assertEq(validFrom, 100);
        assertEq(validUntil, 200);
        assertEq(revokedAt, 0);

        // Guardian is NOT the owner - key additions are timelocked-governance only.
        vm.prank(guardian);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, guardian)
        );
        d.dkim.setKey(TEST_DOMAIN, keccak256("g-key"), 0, 0);

        // Stranger can't either.
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger)
        );
        d.dkim.setKey(TEST_DOMAIN, keccak256("s-key"), 0, 0);
    }

    function test_dkim_revokeKey_ownerAndGuardian_notStranger() public {
        d.dkim.setKey(TEST_DOMAIN, TEST_KEY, 0, 0);

        // Stranger cannot revoke.
        vm.prank(stranger);
        vm.expectRevert(DKIMRegistry.NotOwnerNorGuardian.selector);
        d.dkim.revokeKey(TEST_DOMAIN, TEST_KEY);

        // Guardian revokes fast, no timelock.
        vm.prank(guardian);
        d.dkim.revokeKey(TEST_DOMAIN, TEST_KEY);
        (,,, uint64 revokedAt) = d.dkim.keys(TEST_DOMAIN, TEST_KEY);
        assertEq(revokedAt, uint64(block.timestamp));

        // Owner may also revoke (a different key).
        bytes32 key2 = keccak256("second-key");
        d.dkim.setKey(TEST_DOMAIN, key2, 0, 0);
        d.dkim.revokeKey(TEST_DOMAIN, key2);
        (,,, revokedAt) = d.dkim.keys(TEST_DOMAIN, key2);
        assertEq(revokedAt, uint64(block.timestamp));
    }

    function test_dkim_revokeUnknownKey_reverts() public {
        vm.expectRevert(DKIMRegistry.UnknownKey.selector);
        d.dkim.revokeKey(TEST_DOMAIN, keccak256("never-registered"));
    }

    function test_dkim_isKeyValid_windowBoundaries() public {
        d.dkim.setKey(TEST_DOMAIN, TEST_KEY, 100, 200);

        assertFalse(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, 99), "before validFrom");
        assertTrue(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, 100), "at validFrom");
        assertTrue(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, 150), "inside window");
        assertTrue(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, 200), "at validUntil");
        assertFalse(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, 201), "after validUntil");
    }

    function test_dkim_isKeyValid_openEndedWindows() public {
        // validFrom = 0 (epoch), validUntil = 0 (open): valid for any timestamp.
        d.dkim.setKey(TEST_DOMAIN, TEST_KEY, 0, 0);
        assertTrue(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, 0));
        assertTrue(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, type(uint64).max));

        // validFrom set, validUntil open.
        bytes32 key2 = keccak256("from-only");
        d.dkim.setKey(TEST_DOMAIN, key2, 500, 0);
        assertFalse(d.dkim.isKeyValid(TEST_DOMAIN, key2, 499));
        assertTrue(d.dkim.isKeyValid(TEST_DOMAIN, key2, 500));
        assertTrue(d.dkim.isKeyValid(TEST_DOMAIN, key2, type(uint64).max));
    }

    function test_dkim_isKeyValid_unknownKey() public view {
        assertFalse(d.dkim.isKeyValid(TEST_DOMAIN, keccak256("unknown"), 100));
        // Known key under a *different* domain does not leak validity.
        assertFalse(d.dkim.isKeyValid(keccak256("other.example"), dkimKeyOf(GOV_A), 100));
    }

    function test_dkim_revokedKey_deadForAllTimestamps() public {
        d.dkim.setKey(TEST_DOMAIN, TEST_KEY, 100, 200);
        vm.prank(guardian);
        d.dkim.revokeKey(TEST_DOMAIN, TEST_KEY);

        // Dead even for emails predating the revocation / inside the window.
        assertFalse(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, 0));
        assertFalse(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, 100));
        assertFalse(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, 150));
        assertFalse(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, 200));
        assertFalse(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, type(uint64).max));
    }

    function test_dkim_guardianRotation() public {
        address newGuardian = makeAddr("newGuardian");

        // Only owner may rotate the guardian.
        vm.prank(guardian);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, guardian)
        );
        d.dkim.setGuardian(newGuardian);

        d.dkim.setGuardian(newGuardian);
        assertEq(d.dkim.guardian(), newGuardian);

        d.dkim.setKey(TEST_DOMAIN, TEST_KEY, 0, 0);

        // Old guardian lost revocation power.
        vm.prank(guardian);
        vm.expectRevert(DKIMRegistry.NotOwnerNorGuardian.selector);
        d.dkim.revokeKey(TEST_DOMAIN, TEST_KEY);

        // New guardian has it.
        vm.prank(newGuardian);
        d.dkim.revokeKey(TEST_DOMAIN, TEST_KEY);
        assertFalse(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, 0));
    }

    function test_dkim_ownerCanReinstateRevokedKey() public {
        // setKey overwrites the whole record, clearing revokedAt: reinstatement is
        // an owner-only (timelocked) action by design.
        d.dkim.setKey(TEST_DOMAIN, TEST_KEY, 0, 0);
        vm.prank(guardian);
        d.dkim.revokeKey(TEST_DOMAIN, TEST_KEY);
        assertFalse(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, 100));

        d.dkim.setKey(TEST_DOMAIN, TEST_KEY, 0, 0);
        assertTrue(d.dkim.isKeyValid(TEST_DOMAIN, TEST_KEY, 100));
    }

    // ======================================================== ZKEmailVerifier

    function test_verifier_unknownPatternHash_false() public {
        vm.warp(T0);
        EmailProof memory p =
            mkProof(GOV_A, keccak256("no-such-pattern"), idNullifier("x"), T0);
        assertFalse(d.verifier.verify(p, 0));
    }

    function test_verifier_happyPath_true() public {
        vm.warp(T0);
        EmailProof memory p = mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("x"), T0);
        assertTrue(d.verifier.verify(p, uint256(uint160(alice))));
    }

    function test_verifier_unregisteredDkimKey_false() public {
        vm.warp(T0);
        EmailProof memory p = mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("x"), T0);
        p.dkimPubkeyHash = keccak256("wrong-key");
        assertFalse(d.verifier.verify(p, 0));
    }

    function test_verifier_revokedDkimKey_false() public {
        vm.warp(T0);
        EmailProof memory p = mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("x"), T0);
        assertTrue(d.verifier.verify(p, 0), "valid before revocation");

        vm.prank(guardian);
        d.dkim.revokeKey(GOV_A, dkimKeyOf(GOV_A));
        assertFalse(d.verifier.verify(p, 0), "dead after revocation");
    }

    function test_verifier_dkimKeyOutsideWindow_false() public {
        // Key valid only for emailTimestamps in [T0, T0 + 1 days].
        d.dkim.setKey(TEST_DOMAIN, dkimKeyOf(TEST_DOMAIN), T0, T0 + 1 days);
        EmailProof memory p =
            mkProof(TEST_DOMAIN, CITIZENSHIP_PATTERN, idNullifier("x"), T0 - 1);
        assertFalse(d.verifier.verify(p, 0), "before window");
        p.emailTimestamp = T0;
        assertTrue(d.verifier.verify(p, 0), "window start");
        p.emailTimestamp = T0 + 1 days + 1;
        assertFalse(d.verifier.verify(p, 0), "after window");
    }

    function test_verifier_groth16ResultFalse_false() public {
        vm.warp(T0);
        EmailProof memory p = mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("x"), T0);
        d.groth16.setResult(false);
        assertFalse(d.verifier.verify(p, 0));
        d.groth16.setResult(true);
        assertTrue(d.verifier.verify(p, 0));
    }

    function test_verifier_publicInputOrdering() public {
        // Prove the exact tuple [dkimPubkeyHash, domainHash, nullifier, patternHash,
        // emailTimestamp, extraData] reaches the Groth16 verifier by vetoing it.
        bytes32 nullifier = idNullifier("ordering");
        uint256 extra = uint256(uint160(alice));
        EmailProof memory p = mkProof(GOV_A, CITIZENSHIP_PATTERN, nullifier, T0);

        uint256[6] memory exact = [
            uint256(dkimKeyOf(GOV_A)),
            uint256(GOV_A),
            uint256(nullifier),
            uint256(CITIZENSHIP_PATTERN),
            uint256(T0),
            extra
        ];
        d.groth16.setVetoed(exact, true);
        assertFalse(d.verifier.verify(p, extra), "exact tuple vetoed");

        // Different extraData escapes the veto - extraData is the 6th input.
        assertTrue(d.verifier.verify(p, uint256(uint160(bob))), "other extraData passes");

        // A permuted tuple (first two inputs swapped) does NOT match what the
        // contract sends, so vetoing it changes nothing.
        d.groth16.setVetoed(exact, false);
        uint256[6] memory swapped = [
            uint256(GOV_A),
            uint256(dkimKeyOf(GOV_A)),
            uint256(nullifier),
            uint256(CITIZENSHIP_PATTERN),
            uint256(T0),
            extra
        ];
        d.groth16.setVetoed(swapped, true);
        assertTrue(d.verifier.verify(p, extra), "swapped-order veto never hit");
    }

    function test_verifier_setVerifier_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger)
        );
        d.verifier.setVerifier(CITIZENSHIP_PATTERN, IGroth16Verifier(address(d.groth16)));

        // Owner may clear the route; verification then fails closed.
        d.verifier.setVerifier(CITIZENSHIP_PATTERN, IGroth16Verifier(address(0)));
        EmailProof memory p = mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("x"), T0);
        assertFalse(d.verifier.verify(p, 0));
    }

    // ======================================================= IdentityRegistry

    function test_identity_freshEnrollment() public {
        vm.warp(T0);
        registerMember(alice, Community.A, "alice");

        (Community community, bytes32 nullifier, uint64 registeredAt, uint64 expiresAt) =
            d.identity.members(alice);
        assertEq(uint8(community), uint8(Community.A));
        assertEq(nullifier, idNullifier("alice"));
        assertEq(registeredAt, T0);
        assertEq(expiresAt, T0 + d.identity.membershipDuration());

        assertTrue(d.identity.isActiveMember(alice));
        assertEq(uint8(d.identity.communityOf(alice)), uint8(Community.A));
        assertEq(d.identity.nullifierOf(alice), idNullifier("alice"));
        assertEq(d.identity.nullifierWallet(idNullifier("alice")), alice);
        assertEq(d.identity.lastProofTimestamp(idNullifier("alice")), T0);
        assertEq(d.identity.memberCount(Community.A), 1);
        assertEq(d.identity.memberCount(Community.B), 0);
        assertEq(d.identity.totalMembers(), 1);
    }

    function test_identity_memberCount_perCommunity() public {
        vm.warp(T0);
        registerMember(alice, Community.A, "alice");
        registerMember(bob, Community.B, "bob");
        address avi = makeAddr("avi");
        registerMember(avi, Community.A, "avi");

        assertEq(d.identity.memberCount(Community.A), 2);
        assertEq(d.identity.memberCount(Community.B), 1);
        assertEq(d.identity.totalMembers(), 3);
    }

    function test_identity_enrollment_snapshotsPoolCheckpoint() public {
        vm.warp(T0);
        // First member enrolls at accumulator 0.
        registerMember(alice, Community.A, "alice");
        assertEq(d.poolA.rewardCheckpoint(idNullifier("alice")), 0);

        // A reward lands (engine-authorized accounting call): acc rises.
        vm.prank(address(d.engine));
        d.poolA.notifyReward(100e18);
        uint256 acc = d.poolA.accRewardPerMember();
        assertGt(acc, 0);
        assertEq(d.poolA.claimable(alice), 100e18);

        // A later member's checkpoint snapshots the *current* accumulator, so they
        // earn nothing from inflows that predate their enrollment.
        registerMember(bob, Community.A, "bob");
        assertEq(d.poolA.rewardCheckpoint(idNullifier("bob")), acc);
        assertEq(d.poolA.claimable(bob), 0);
        assertEq(d.poolA.claimable(alice), 100e18, "existing member unaffected");
    }

    function test_identity_renewal_extendsExpiryOnly() public {
        vm.warp(T0);
        registerMember(alice, Community.A, "alice");

        vm.warp(T0 + 30 days);
        EmailProof memory p =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("alice"), T0 + 30 days);
        d.identity.register(p, alice);

        (Community community,, uint64 registeredAt, uint64 expiresAt) = d.identity.members(alice);
        assertEq(uint8(community), uint8(Community.A));
        assertEq(registeredAt, T0, "registeredAt untouched by renewal");
        assertEq(expiresAt, T0 + 30 days + d.identity.membershipDuration(), "expiry extended");
        assertEq(d.identity.memberCount(Community.A), 1, "count unchanged");
        assertEq(d.identity.nullifierWallet(idNullifier("alice")), alice);
    }

    function test_identity_lapsedMemberCanRenew() public {
        vm.warp(T0);
        registerMember(alice, Community.A, "alice");
        uint64 expiry = T0 + d.identity.membershipDuration();

        vm.warp(expiry + 10 days);
        assertFalse(d.identity.isActiveMember(alice));

        EmailProof memory p =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("alice"), uint64(block.timestamp));
        d.identity.register(p, alice);
        assertTrue(d.identity.isActiveMember(alice));
        assertEq(d.identity.memberCount(Community.A), 1);
    }

    function test_identity_walletRotation() public {
        vm.warp(T0);
        registerMember(alice, Community.A, "alice");

        vm.warp(T0 + 1 days);
        EmailProof memory p =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("alice"), T0 + 1 days);
        d.identity.register(p, bob);

        // Old wallet fully deleted.
        (Community oldCommunity, bytes32 oldNullifier,, uint64 oldExpiry) =
            d.identity.members(alice);
        assertEq(uint8(oldCommunity), uint8(Community.None));
        assertEq(oldNullifier, bytes32(0));
        assertEq(oldExpiry, 0);
        assertFalse(d.identity.isActiveMember(alice));

        // New wallet carries the identity.
        (Community community, bytes32 nullifier, uint64 registeredAt, uint64 expiresAt) =
            d.identity.members(bob);
        assertEq(uint8(community), uint8(Community.A));
        assertEq(nullifier, idNullifier("alice"));
        assertEq(registeredAt, T0 + 1 days);
        assertEq(expiresAt, T0 + 1 days + d.identity.membershipDuration());
        assertEq(d.identity.nullifierWallet(idNullifier("alice")), bob);

        // One email account still == one member.
        assertEq(d.identity.memberCount(Community.A), 1, "count unchanged by rotation");
    }

    function test_identity_rotation_rewardsFollowNullifier() public {
        vm.warp(T0);
        registerMember(alice, Community.A, "alice");
        vm.prank(address(d.engine));
        d.poolA.notifyReward(100e18);
        assertEq(d.poolA.claimable(alice), 100e18);
        uint256 checkpointBefore = d.poolA.rewardCheckpoint(idNullifier("alice"));

        vm.warp(T0 + 1 days);
        EmailProof memory p =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("alice"), T0 + 1 days);
        d.identity.register(p, bob);

        // Rotation must NOT re-init the checkpoint: unclaimed rewards survive.
        assertEq(d.poolA.rewardCheckpoint(idNullifier("alice")), checkpointBefore);
        assertEq(d.poolA.claimable(bob), 100e18, "rewards follow the member");
        assertEq(d.poolA.claimable(alice), 0, "old wallet no longer a member");
    }

    function test_identity_rotation_crossCommunity_reverts() public {
        vm.warp(T0);
        // Same email nullifier, but the new proof comes from the other community's
        // government domain: forbidden.
        registerMember(alice, Community.A, "alice");
        EmailProof memory p =
            mkProof(GOV_B, CITIZENSHIP_PATTERN, idNullifier("alice"), T0 + 1);
        vm.expectRevert(IdentityRegistry.CommunityMismatch.selector);
        d.identity.register(p, bob);
    }

    function test_identity_rotation_targetAlreadyMember_reverts() public {
        vm.warp(T0);
        registerMember(alice, Community.A, "alice");
        registerMember(bob, Community.A, "bob");

        // alice's email account cannot capture bob's already-enrolled wallet.
        EmailProof memory p =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("alice"), T0 + 1);
        vm.expectRevert(IdentityRegistry.WalletAlreadyMember.selector);
        d.identity.register(p, bob);
    }

    function test_identity_freshEnrollment_walletAlreadyMember_reverts() public {
        vm.warp(T0);
        registerMember(alice, Community.A, "alice");

        // A *different* email account also cannot enroll into an occupied wallet.
        EmailProof memory p =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("second-account"), T0 + 1);
        vm.expectRevert(IdentityRegistry.WalletAlreadyMember.selector);
        d.identity.register(p, alice);
    }

    function test_identity_replay_sameTimestamp_reverts() public {
        vm.warp(T0);
        registerMember(alice, Community.A, "alice"); // consumed emailTs = T0

        EmailProof memory p = mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("alice"), T0);
        vm.expectRevert(IdentityRegistry.ProofReplayed.selector);
        d.identity.register(p, alice);
    }

    function test_identity_replay_olderTimestamp_reverts() public {
        vm.warp(T0);
        registerMember(alice, Community.A, "alice"); // consumed emailTs = T0

        EmailProof memory p =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("alice"), T0 - 1);
        vm.expectRevert(IdentityRegistry.ProofReplayed.selector);
        d.identity.register(p, alice);
    }

    function test_identity_replay_newerTimestampAccepted() public {
        vm.warp(T0);
        registerMember(alice, Community.A, "alice");

        // A strictly newer email (even 1 second) is a fresh action.
        EmailProof memory p =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("alice"), T0 + 1);
        d.identity.register(p, alice);
        assertEq(d.identity.lastProofTimestamp(idNullifier("alice")), T0 + 1);
    }

    function test_identity_staleProof_boundary() public {
        uint64 maxAge = d.identity.maxProofAge();

        // Exactly maxProofAge old: still accepted (strict > in the check).
        vm.warp(T0 + maxAge);
        EmailProof memory ok = mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("edge"), T0);
        d.identity.register(ok, alice);
        assertTrue(d.identity.isActiveMember(alice));

        // One second past: stale.
        vm.warp(T0 + maxAge + 1);
        EmailProof memory stale =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("edge2"), T0);
        vm.expectRevert(IdentityRegistry.StaleProof.selector);
        d.identity.register(stale, bob);
    }

    function test_identity_futureProof_boundary() public {
        vm.warp(T0);

        // Exactly +1h clock skew: accepted.
        EmailProof memory ok =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("skew"), T0 + 1 hours);
        d.identity.register(ok, alice);

        // One second beyond the slack: rejected.
        EmailProof memory future =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("skew2"), T0 + 1 hours + 1);
        vm.expectRevert(IdentityRegistry.FutureProof.selector);
        d.identity.register(future, bob);
    }

    function test_identity_domainNotAllowlisted_reverts() public {
        vm.warp(T0);
        // NEWS_A1 has a registered DKIM key and the pattern has a verifier, so the
        // ZK layer passes - but the domain maps to Community.None.
        EmailProof memory p =
            mkProof(NEWS_A1, CITIZENSHIP_PATTERN, idNullifier("alice"), T0);
        vm.expectRevert(IdentityRegistry.DomainNotAllowlisted.selector);
        d.identity.register(p, alice);
    }

    function test_identity_patternNotApproved_reverts() public {
        vm.warp(T0);
        // NEWS_PATTERN is routed in the ZK verifier but is not a citizenship pattern.
        EmailProof memory p = mkProof(GOV_A, NEWS_PATTERN, idNullifier("alice"), T0);
        vm.expectRevert(IdentityRegistry.PatternNotApproved.selector);
        d.identity.register(p, alice);
    }

    function test_identity_invalidProof_whenGroth16Fails() public {
        vm.warp(T0);
        EmailProof memory p = mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("alice"), T0);
        d.groth16.setResult(false);
        vm.expectRevert(IdentityRegistry.InvalidProof.selector);
        d.identity.register(p, alice);

        // Flipping the mock back makes the same proof enroll - nothing was consumed.
        d.groth16.setResult(true);
        d.identity.register(p, alice);
        assertTrue(d.identity.isActiveMember(alice));
    }

    function test_identity_invalidProof_whenDkimKeyRevoked() public {
        vm.warp(T0);
        vm.prank(guardian);
        d.dkim.revokeKey(GOV_A, dkimKeyOf(GOV_A));

        EmailProof memory p = mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("alice"), T0);
        vm.expectRevert(IdentityRegistry.InvalidProof.selector);
        d.identity.register(p, alice);
    }

    function test_identity_expiryBoundary() public {
        vm.warp(T0);
        registerMember(alice, Community.A, "alice");
        uint64 expiresAt = T0 + d.identity.membershipDuration();

        vm.warp(expiresAt);
        assertTrue(d.identity.isActiveMember(alice), "active at exactly expiresAt");

        vm.warp(expiresAt + 1);
        assertFalse(d.identity.isActiveMember(alice), "lapsed one second later");

        // Lapsed members keep community + count (renewable, still dilute quorum).
        assertEq(uint8(d.identity.communityOf(alice)), uint8(Community.A));
        assertEq(d.identity.memberCount(Community.A), 1);
    }

    function test_identity_adminSetters_onlyOwner() public {
        vm.startPrank(stranger);
        bytes memory err =
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger);

        vm.expectRevert(err);
        d.identity.setDurations(1 days, 30 days);
        vm.expectRevert(err);
        d.identity.setDomain(TEST_DOMAIN, Community.A);
        vm.expectRevert(err);
        d.identity.setPools(d.poolA, d.poolB);
        vm.expectRevert(err);
        d.identity.setCitizenshipPattern(NEWS_PATTERN, true);
        vm.stopPrank();
    }

    function test_identity_setDurations_takesEffect() public {
        d.identity.setDurations(1 days, 10 days);
        assertEq(d.identity.maxProofAge(), 1 days);
        assertEq(d.identity.membershipDuration(), 10 days);

        // New maxProofAge enforced.
        vm.warp(T0 + 1 days + 1);
        EmailProof memory stale =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("alice"), T0);
        vm.expectRevert(IdentityRegistry.StaleProof.selector);
        d.identity.register(stale, alice);

        // New membershipDuration applied on enrollment.
        EmailProof memory fresh =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("alice"), uint64(block.timestamp));
        d.identity.register(fresh, alice);
        (,,, uint64 expiresAt) = d.identity.members(alice);
        assertEq(expiresAt, uint64(block.timestamp) + 10 days);
    }

    function test_identity_setDomain_deallowlisting() public {
        vm.warp(T0);
        registerMember(alice, Community.A, "alice");

        // Owner can pull a domain off the allowlist; future proofs from it fail.
        d.identity.setDomain(GOV_A, Community.None);
        EmailProof memory p =
            mkProof(GOV_A, CITIZENSHIP_PATTERN, idNullifier("bob"), T0 + 1);
        vm.expectRevert(IdentityRegistry.DomainNotAllowlisted.selector);
        d.identity.register(p, bob);
    }

    function test_identity_register_withUnsetPool_succeeds() public {
        // Pool wiring is optional: registration must not depend on it.
        d.identity.setPools(ICommunityPool(address(0)), ICommunityPool(address(0)));
        vm.warp(T0);
        registerMember(alice, Community.A, "alice");
        assertTrue(d.identity.isActiveMember(alice));
        assertEq(d.identity.memberCount(Community.A), 1);
    }

    function test_identity_relayedRegistration_walletBoundInProof() public {
        vm.warp(T0);
        bytes32 nullifier = idNullifier("relayed");

        // The proof commits to alice (extraData = uint160(alice)). Veto exactly that
        // 6-tuple in the mock: any registration *targeting alice* with this email
        // must fail, while the same envelope aimed anywhere else still verifies -
        // i.e. the wallet argument is precisely the proof's 6th public input.
        EmailProof memory p = mkProof(GOV_A, CITIZENSHIP_PATTERN, nullifier, T0);
        uint256[6] memory boundToAlice = [
            uint256(dkimKeyOf(GOV_A)),
            uint256(GOV_A),
            uint256(nullifier),
            uint256(CITIZENSHIP_PATTERN),
            uint256(T0),
            uint256(uint160(alice))
        ];
        d.groth16.setVetoed(boundToAlice, true);

        // Relayer (any third party) submits: binding, not msg.sender, decides.
        vm.prank(stranger);
        vm.expectRevert(IdentityRegistry.InvalidProof.selector);
        d.identity.register(p, alice);

        vm.prank(stranger);
        d.identity.register(p, bob);
        assertTrue(d.identity.isActiveMember(bob), "relayed enrollment landed on bob");
        assertEq(d.identity.nullifierOf(bob), nullifier);
        assertFalse(d.identity.isActiveMember(stranger), "relayer got nothing");
        assertFalse(d.identity.isActiveMember(alice));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {Community, EmailProof} from "../src/Types.sol";
import {ExitAssurance} from "../src/ExitAssurance.sol";
import {ExitReceiptVerifier} from "../src/ExitReceiptVerifier.sol";
import {IGroth16Verifier} from "../src/interfaces/IGroth16Verifier.sol";

/// @notice The Exit mechanism end-to-end: the sDAI stock (commit/redeem) that IS the
///         honest Exit Index, the nullifier Sybil cap (funds follow the person, not the
///         wallet), the assurance-campaign threshold coordination, and the optional
///         DKIM conversion-receipt provenance bound to the claimer's own address.
contract ExitTest is BaseTest {
    ExitAssurance internal exit;

    // The synthetic receipt names this address as its destination, so it must be the
    // member that attests provenance.
    address internal constant DEST = 0x1111111111111111111111111111111111111111;
    string internal constant RAMP_FROM = "info@bit2c-demo.example";

    bytes internal rSignedHeaders;
    bytes internal rSignature;
    bytes internal rBody;
    bytes32 internal rampKeyId;

    bytes32 internal constant EXIT_PATTERN = keccak256("p2peace/exit-receipt-v1");
    bytes32 internal constant BIT2C = keccak256("bit2c.co.il");

    function setUp() public override {
        super.setUp();
        exit = d.exitAssurance;

        // Public path: register the synthetic ramp key + allowlist its sender.
        string memory json = vm.readFile("test/exit-receipt-vector.json");
        rSignedHeaders = vm.parseJsonBytes(json, ".signedData");
        rSignature = vm.parseJsonBytes(json, ".signature");
        rBody = vm.parseJsonBytes(json, ".body");
        bytes memory modulus = vm.parseJsonBytes(json, ".modulus");
        bytes memory exponent = vm.parseJsonBytes(json, ".exponent");
        rampKeyId = d.exitReceipt.registerKey("bit2c-demo.example", "s1", modulus, exponent);
        exit.setRampKey(rampKeyId, RAMP_FROM);

        // Private (ZK) path: route the exit-receipt blueprint to the mock verifier,
        // register Bit2C's domain key, and allowlist the pattern + domain.
        d.verifier.setVerifier(EXIT_PATTERN, IGroth16Verifier(address(d.groth16)));
        d.dkim.setKey(BIT2C, dkimKeyOf(BIT2C), 0, 0);
        exit.setExitPattern(EXIT_PATTERN);
        exit.setRampDomain(BIT2C, true);
    }

    // -------------------------------------------------------- commit / redeem

    function _fundedMember(address wallet, string memory seed, uint256 amount) internal {
        registerMember(wallet, Community.A, seed);
        mintUsd(wallet, amount);
        vm.prank(wallet);
        d.usd.approve(address(exit), type(uint256).max);
    }

    function test_commit_growsIndex_andHoldsStock() public {
        address a = makeAddr("exiterA");
        _fundedMember(a, "a", 100e18);

        vm.prank(a);
        exit.commit(60e18);

        assertEq(exit.exitIndex(), 60e18, "index = locked sDAI");
        assertEq(exit.positionOf(a), 60e18, "position tracked");
        assertEq(exit.totalExited(), d.usd.balanceOf(address(exit)), "stock invariant");
    }

    function test_redeem_shrinksIndex_returnsFunds() public {
        address a = makeAddr("exiterA");
        _fundedMember(a, "a", 100e18);
        vm.startPrank(a);
        exit.commit(60e18);
        exit.redeem(25e18);
        vm.stopPrank();

        assertEq(exit.exitIndex(), 35e18, "round-trip shrinks the index");
        assertEq(exit.positionOf(a), 35e18);
        assertEq(d.usd.balanceOf(a), 65e18, "funds returned (100-60+25)");
        assertEq(exit.totalExited(), d.usd.balanceOf(address(exit)), "stock invariant");
    }

    function test_nonMember_cannotCommit() public {
        address stranger = makeAddr("stranger");
        mintUsd(stranger, 10e18);
        vm.startPrank(stranger);
        d.usd.approve(address(exit), type(uint256).max);
        vm.expectRevert(ExitAssurance.NotMember.selector);
        exit.commit(10e18);
        vm.stopPrank();
    }

    function test_redeem_moreThanFree_reverts() public {
        address a = makeAddr("exiterA");
        _fundedMember(a, "a", 100e18);
        vm.startPrank(a);
        exit.commit(40e18);
        vm.expectRevert(ExitAssurance.InsufficientPosition.selector);
        exit.redeem(41e18);
        vm.stopPrank();
    }

    // ------------------------------------------- Sybil cap: funds follow the person

    function test_positionFollowsWalletRotation() public {
        address w1 = makeAddr("wallet1");
        address w2 = makeAddr("wallet2");
        _fundedMember(w1, "person", 100e18);
        vm.prank(w1);
        exit.commit(50e18);

        // Rotate the SAME citizenship (same nullifier seed) to a new wallet.
        vm.warp(block.timestamp + 1); // fresh email timestamp for the rotation proof
        registerMember(w2, Community.A, "person");

        assertEq(exit.positionOf(w2), 50e18, "position follows the person to the new wallet");
        assertEq(exit.positionOf(w1), 0, "old wallet no longer holds the nullifier");

        // The new wallet can redeem; the rotated-away wallet cannot.
        vm.prank(w2);
        exit.redeem(50e18);
        assertEq(d.usd.balanceOf(w2), 50e18, "rotated wallet withdraws the position");

        vm.prank(w1);
        vm.expectRevert(ExitAssurance.NotMember.selector);
        exit.redeem(1e18);
    }

    // --------------------------------------------------- assurance campaigns

    function test_campaign_pledge_reaches_and_unpledge() public {
        address a = makeAddr("exiterA");
        address b = makeAddr("exiterB");
        _fundedMember(a, "a", 100e18);
        registerMember(b, Community.B, "b");
        mintUsd(b, 100e18);
        vm.prank(b);
        d.usd.approve(address(exit), type(uint256).max);

        vm.prank(a);
        uint256 id = exit.createCampaign(80e18, uint64(block.timestamp + 30 days), "ipfs://goal");

        vm.prank(a);
        exit.pledge(id, 50e18);
        (,,,, uint256 total1, bool reached1,) = exit.getCampaign(id);
        assertEq(total1, 50e18);
        assertFalse(reached1, "not reached yet");

        vm.prank(b);
        exit.pledge(id, 40e18); // crosses 80e18 goal
        (,,,, uint256 total2, bool reached2,) = exit.getCampaign(id);
        assertEq(total2, 90e18);
        assertTrue(reached2, "goal reached tips reached=true");
        assertEq(exit.exitIndex(), 90e18, "pledges count in the index immediately");

        // Pledged funds are not redeemable via redeem() (they're earmarked)...
        vm.prank(a);
        vm.expectRevert(ExitAssurance.InsufficientPosition.selector);
        exit.redeem(1e18);

        // ...but a pledger can always unpledge their own funds; reached stays sticky.
        vm.prank(a);
        exit.unpledge(id, 50e18);
        (,,,, uint256 total3, bool reached3,) = exit.getCampaign(id);
        assertEq(total3, 40e18, "unpledge lowers the live total");
        assertTrue(reached3, "reached is a historical fact, stays true");
        assertEq(d.usd.balanceOf(a), 100e18, "funds never trapped");
        assertEq(exit.totalExited(), d.usd.balanceOf(address(exit)), "stock invariant");
    }

    function test_pledge_afterDeadline_reverts() public {
        address a = makeAddr("exiterA");
        _fundedMember(a, "a", 100e18);
        vm.prank(a);
        uint256 id = exit.createCampaign(80e18, uint64(block.timestamp + 1 days), "ipfs://goal");
        vm.warp(block.timestamp + 2 days);
        vm.prank(a);
        vm.expectRevert(ExitAssurance.CampaignExpired.selector);
        exit.pledge(id, 10e18);
    }

    // ------------------------------------------------------------ provenance

    function test_provenance_attest_bindsAndCounts() public {
        _fundedMember(DEST, "dest", 100e18);
        vm.startPrank(DEST);
        exit.commit(20e18);
        exit.attestProvenance(rampKeyId, rSignedHeaders, rSignature, rBody);
        vm.stopPrank();

        assertTrue(exit.provenanceAttested(idNullifier("dest")), "member flagged");
        assertEq(exit.attestedExits(), 1, "one attested exit, address bound + verified");
        // Real-format receipts (Bit2C) carry no ILS marker — amount is best-effort 0.
        assertEq(exit.attestedIlsTotal(), 0, "no ILS marker in a real conversion receipt");
    }

    function test_provenance_replayReceipt_reverts() public {
        _fundedMember(DEST, "dest", 100e18);
        vm.startPrank(DEST);
        exit.attestProvenance(rampKeyId, rSignedHeaders, rSignature, rBody);
        vm.expectRevert(ExitAssurance.ReceiptAlreadyUsed.selector);
        exit.attestProvenance(rampKeyId, rSignedHeaders, rSignature, rBody);
        vm.stopPrank();
    }

    function test_provenance_wrongClaimer_reverts() public {
        // A different member cannot claim a receipt bound to DEST's address.
        address other = makeAddr("other");
        _fundedMember(other, "other", 100e18);
        vm.prank(other);
        vm.expectRevert(ExitReceiptVerifier.AddressMismatch.selector);
        exit.attestProvenance(rampKeyId, rSignedHeaders, rSignature, rBody);
    }

    // ---------------------------------------------- private (ZK) provenance path

    function _exitProof(string memory seed) internal view returns (EmailProof memory) {
        // Only the nullifier is ever revealed; no address, no email, in calldata.
        return mkProof(BIT2C, EXIT_PATTERN, emailNullifier(seed), uint64(block.timestamp));
    }

    function test_provenanceZK_countsExit_revealsOnlyNullifier() public {
        address m = makeAddr("zkmember");
        registerMember(m, Community.A, "zk");
        vm.prank(m);
        exit.attestProvenanceZK(_exitProof("zk-receipt-1"));

        assertTrue(exit.provenanceAttested(idNullifier("zk")), "member flagged via ZK proof");
        assertEq(exit.attestedExits(), 1, "counted without revealing the address");
        assertTrue(exit.receiptUsed(emailNullifier("zk-receipt-1")), "receipt nullifier spent");
    }

    function test_provenanceZK_replay_reverts() public {
        address m = makeAddr("zkmember");
        registerMember(m, Community.A, "zk");
        vm.startPrank(m);
        exit.attestProvenanceZK(_exitProof("zk-receipt-1"));
        vm.expectRevert(ExitAssurance.ReceiptAlreadyUsed.selector);
        exit.attestProvenanceZK(_exitProof("zk-receipt-1"));
        vm.stopPrank();
    }

    function test_provenanceZK_wrongPattern_reverts() public {
        address m = makeAddr("zkmember");
        registerMember(m, Community.A, "zk");
        EmailProof memory p =
            mkProof(BIT2C, keccak256("not-the-exit-pattern"), emailNullifier("x"), uint64(block.timestamp));
        vm.prank(m);
        vm.expectRevert(ExitAssurance.PatternNotAllowed.selector);
        exit.attestProvenanceZK(p);
    }

    function test_provenanceZK_nonRampDomain_reverts() public {
        address m = makeAddr("zkmember");
        registerMember(m, Community.A, "zk");
        EmailProof memory p =
            mkProof(keccak256("not-a-ramp.example"), EXIT_PATTERN, emailNullifier("y"), uint64(block.timestamp));
        vm.prank(m);
        vm.expectRevert(ExitAssurance.RampNotMapped.selector);
        exit.attestProvenanceZK(p);
    }

    function test_provenanceZK_nonMember_reverts() public {
        EmailProof memory p = _exitProof("z");
        vm.prank(makeAddr("nonmember"));
        vm.expectRevert(ExitAssurance.NotMember.selector);
        exit.attestProvenanceZK(p);
    }
}

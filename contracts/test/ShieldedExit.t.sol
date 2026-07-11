// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {Vm} from "forge-std/Vm.sol";
import {Community, EmailProof} from "../src/Types.sol";
import {ExitAssurance} from "../src/ExitAssurance.sol";
import {ProvenanceShieldedPool} from "../src/ProvenanceShieldedPool.sol";
import {MockGroth16Verifier} from "../src/mocks/MockGroth16Verifier.sol";
import {IGroth16Verifier} from "../src/interfaces/IGroth16Verifier.sol";

/// @notice The shielded exit: a citizen's KYC-linked Bit2C wallet (W_kyc) exits into a
///         generic verified-exit pool, and an anonymous, relayer-submitted withdrawal
///         credits the p2p2p Exit Index — with NO on-chain edge linking W_kyc to p2p2p.
///
///         The STRUCTURE tested here is real (tree, nullifier dedup, single-use
///         vouchers, fixed denomination, relayer fee bound via extDataHash, member-less
///         sink). Real ANONYMITY additionally needs a compiled Merkle-membership
///         withdraw circuit — here the withdraw verifier is a mock, so these tests prove
///         the plumbing + unlinkability-by-construction, not the ZK guarantee itself.
contract ShieldedExitTest is BaseTest {
    ProvenanceShieldedPool internal pool;
    MockGroth16Verifier internal withdrawMock;
    ExitAssurance internal exit;

    bytes32 internal constant EXIT_PATTERN = keccak256("p2peace/exit-receipt-v1");
    bytes32 internal constant BIT2C = keccak256("bit2c.co.il");
    uint256 internal constant DENOM = 1000e18;

    address internal bit2cHot = makeAddr("bit2cHotWallet");
    address internal wKyc = makeAddr("W_kyc"); // KYC/gov-linked settlement wallet
    address internal relayer = makeAddr("relayer");

    function setUp() public override {
        super.setUp();
        exit = d.exitAssurance;

        // Provenance gate: route the exit blueprint to the (provenance) mock + register
        // Bit2C's domain key so zkEmailVerifier.isKeyValid passes.
        d.verifier.setVerifier(EXIT_PATTERN, IGroth16Verifier(address(d.groth16)));
        d.dkim.setKey(BIT2C, dkimKeyOf(BIT2C), 0, 0);

        // A SEPARATE mock for the withdraw circuit (so vetoing it doesn't touch provenance).
        withdrawMock = new MockGroth16Verifier();

        pool = new ProvenanceShieldedPool(
            d.usd, exit, d.verifier, IGroth16Verifier(address(withdrawMock)),
            DENOM, EXIT_PATTERN, 1, 20, address(this)
        );
        pool.setRampDomain(BIT2C, true);
        exit.setPool(address(pool));
    }

    // ---- helpers

    function _voucherProof(string memory seed) internal view returns (EmailProof memory) {
        return mkProof(BIT2C, EXIT_PATTERN, emailNullifier(seed), uint64(block.timestamp));
    }

    /// Simulate Bit2C's omnibus payout landing at W_kyc, then W_kyc funds the deposit.
    function _bit2cPayout(address to) internal {
        mintUsd(bit2cHot, DENOM);
        vm.prank(bit2cHot);
        d.usd.transfer(to, DENOM);
    }

    // ---- voucher gating

    function test_mintVoucher_wrongPattern_reverts() public {
        EmailProof memory p =
            mkProof(BIT2C, keccak256("not-exit"), emailNullifier("x"), uint64(block.timestamp));
        vm.expectRevert(ProvenanceShieldedPool.PatternNotAllowed.selector);
        pool.mintVoucher(p);
    }

    function test_mintVoucher_nonRampDomain_reverts() public {
        EmailProof memory p =
            mkProof(keccak256("evil.example"), EXIT_PATTERN, emailNullifier("x"), uint64(block.timestamp));
        vm.expectRevert(ProvenanceShieldedPool.RampNotAllowed.selector);
        pool.mintVoucher(p);
    }

    function test_voucher_singleUse() public {
        pool.mintVoucher(_voucherProof("v1"));
        vm.expectRevert(ProvenanceShieldedPool.VoucherUsed.selector);
        pool.mintVoucher(_voucherProof("v1"));
    }

    // ---- deposit

    function _depositOnce(address depositor, string memory vseed, bytes32 commitment)
        internal
        returns (bytes32 exitNf)
    {
        exitNf = emailNullifier(vseed);
        pool.mintVoucher(_voucherProof(vseed));
        _bit2cPayout(depositor);
        vm.startPrank(depositor);
        d.usd.approve(address(pool), DENOM);
        pool.deposit(exitNf, commitment);
        vm.stopPrank();
    }

    function test_deposit_insertsLeaf_consumesVoucher_holdsFunds() public {
        _depositOnce(wKyc, "d1", keccak256("commit-1"));
        assertEq(pool.depositCount(), 1);
        assertTrue(pool.voucherSpent(emailNullifier("d1")));
        assertEq(d.usd.balanceOf(address(pool)), DENOM, "pool custodies the denomination");
    }

    function test_deposit_reusedVoucher_reverts() public {
        bytes32 nf = _depositOnce(wKyc, "d1", keccak256("commit-1"));
        _bit2cPayout(wKyc);
        vm.startPrank(wKyc);
        d.usd.approve(address(pool), DENOM);
        vm.expectRevert(ProvenanceShieldedPool.VoucherUnknown.selector);
        pool.deposit(nf, keccak256("commit-2"));
        vm.stopPrank();
    }

    function test_deposit_duplicateCommitment_reverts() public {
        _depositOnce(wKyc, "d1", keccak256("commit-dup"));
        pool.mintVoucher(_voucherProof("d2"));
        _bit2cPayout(wKyc);
        vm.startPrank(wKyc);
        d.usd.approve(address(pool), DENOM);
        vm.expectRevert(ProvenanceShieldedPool.CommitmentExists.selector);
        pool.deposit(emailNullifier("d2"), keccak256("commit-dup"));
        vm.stopPrank();
    }

    // ---- withdraw

    function _withdraw(bytes32 nfPool, uint256 fee) internal {
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: relayer, fee: fee});
        uint256[8] memory proof; // mock ignores
        bytes32 root = pool.getLastRoot();
        vm.prank(relayer);
        pool.withdraw(proof, root, nfPool, ext);
    }

    function test_withdraw_creditsExitIndex_paysRelayer_keyedByNullifier() public {
        _depositOnce(wKyc, "d1", keccak256("commit-1"));
        bytes32 nfPool = keccak256("pool-null-1");
        uint256 fee = 5e18;

        _withdraw(nfPool, fee);

        assertTrue(pool.nullifierSpent(nfPool), "pool nullifier spent");
        assertEq(d.usd.balanceOf(relayer), fee, "relayer paid its bound fee");
        assertEq(exit.exitIndex(), DENOM - fee, "exit index credited (denom - fee)");
        assertEq(exit.exited(nfPool), DENOM - fee, "credited to the ANONYMOUS pool nullifier");
        assertEq(exit.totalExited(), d.usd.balanceOf(address(exit)), "stock invariant holds");
    }

    function test_withdraw_belowMinDeposits_reverts() public {
        pool.setMinDeposits(2);
        _depositOnce(wKyc, "d1", keccak256("commit-1"));
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: relayer, fee: 0});
        uint256[8] memory proof;
        bytes32 root = pool.getLastRoot();
        vm.prank(relayer);
        vm.expectRevert(ProvenanceShieldedPool.TooFewDeposits.selector);
        pool.withdraw(proof, root, keccak256("n"), ext);
    }

    function test_withdraw_doubleSpend_reverts() public {
        _depositOnce(wKyc, "d1", keccak256("commit-1"));
        _depositOnce(makeAddr("kyc2"), "d2", keccak256("commit-2"));
        bytes32 nfPool = keccak256("pool-null-1");
        _withdraw(nfPool, 0);
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: relayer, fee: 0});
        uint256[8] memory proof;
        bytes32 root = pool.getLastRoot();
        vm.prank(relayer);
        vm.expectRevert(ProvenanceShieldedPool.NullifierUsed.selector);
        pool.withdraw(proof, root, nfPool, ext);
    }

    function test_withdraw_unknownRoot_reverts() public {
        _depositOnce(wKyc, "d1", keccak256("commit-1"));
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: relayer, fee: 0});
        uint256[8] memory proof;
        vm.prank(relayer);
        vm.expectRevert(ProvenanceShieldedPool.UnknownRoot.selector);
        pool.withdraw(proof, keccak256("never-a-root"), keccak256("n"), ext);
    }

    function test_withdraw_badProof_reverts() public {
        _depositOnce(wKyc, "d1", keccak256("commit-1"));
        withdrawMock.setResult(false); // a failing membership proof must be rejected
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: relayer, fee: 0});
        uint256[8] memory proof;
        bytes32 root = pool.getLastRoot();
        vm.prank(relayer);
        vm.expectRevert(ProvenanceShieldedPool.InvalidProof.selector);
        pool.withdraw(proof, root, keccak256("n"), ext);
    }

    /// The relayer/fee are bound into the proof's public inputs via extDataHash: veto
    /// the exact tuple the contract must produce, and the withdraw must revert — proving
    /// the contract computes extDataHash from ext and a real circuit would bind it.
    function test_withdraw_extDataHash_isBoundIntoProof() public {
        _depositOnce(wKyc, "d1", keccak256("commit-1"));
        bytes32 nfPool = keccak256("pool-null-1");
        uint256 fee = 3e18;
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: relayer, fee: fee});
        uint256 field =
            21888242871839275222246405745257275088548364400416034343698204186575808495617;
        uint256 extDataHash = uint256(keccak256(abi.encode(ext))) % field;
        bytes32 root = pool.getLastRoot();
        withdrawMock.setVetoed([uint256(root), uint256(nfPool), extDataHash, 0, 0, 0], true);
        uint256[8] memory proof;
        vm.prank(relayer);
        vm.expectRevert(ProvenanceShieldedPool.InvalidProof.selector);
        pool.withdraw(proof, root, nfPool, ext);
    }

    // ---- THE KEY PROPERTY: no on-chain event links W_kyc to the p2p2p exit credit.

    function test_unlinkability_noEventTiesKycToExit() public {
        _depositOnce(wKyc, "d1", keccak256("commit-1"));
        bytes32 nfPool = keccak256("pool-null-1");

        vm.recordLogs();
        _withdraw(nfPool, 2e18);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bytes32 kycWord = bytes32(uint256(uint160(wKyc)));
        for (uint256 i = 0; i < logs.length; i++) {
            // W_kyc must not appear in ANY withdrawal-side event (topics or data).
            for (uint256 t = 0; t < logs[i].topics.length; t++) {
                assertTrue(logs[i].topics[t] != kycWord, "W_kyc leaked into a withdraw topic");
            }
            assertFalse(_dataHas(logs[i].data, kycWord), "W_kyc leaked into withdraw data");
        }
        // And the credit is keyed by the anonymous nullifier, not any wallet.
        assertEq(exit.exited(nfPool), DENOM - 2e18);
        assertEq(exit.exited(bytes32(uint256(uint160(wKyc)))), 0, "nothing keyed to W_kyc");
    }

    function _dataHas(bytes memory data, bytes32 word) internal pure returns (bool) {
        if (data.length < 32) return false;
        for (uint256 i = 0; i + 32 <= data.length; i += 32) {
            bytes32 chunk;
            assembly {
                chunk := mload(add(add(data, 0x20), i))
            }
            if (chunk == word) return true;
        }
        return false;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {Vm} from "forge-std/Vm.sol";
import {Community, EmailProof} from "../src/Types.sol";
import {ExitAssurance} from "../src/ExitAssurance.sol";
import {ProvenanceShieldedPool} from "../src/ProvenanceShieldedPool.sol";
import {IHasher} from "../src/lib/MerkleTreeWithHistory.sol";
import {MockGroth16Verifier} from "../src/mocks/MockGroth16Verifier.sol";
import {IGroth16Verifier} from "../src/interfaces/IGroth16Verifier.sol";

/// @notice Structural tests for the shielded pool (deposit/withdraw plumbing, voucher
///         gating, nullifier dedup, relayer-fee binding, anonymous sink) using a MOCK
///         withdraw verifier. The Poseidon tree is REAL here. The REAL Groth16 withdraw
///         proof is exercised separately in ShieldedExitReal.t.sol.
contract ShieldedExitTest is BaseTest {
    ProvenanceShieldedPool internal pool;
    MockGroth16Verifier internal withdrawMock;
    IHasher internal hasher;
    ExitAssurance internal exit;

    bytes32 internal constant EXIT_PATTERN = keccak256("p2peace/exit-receipt-v1");
    bytes32 internal constant BIT2C = keccak256("bit2c.co.il");
    uint256 internal constant DENOM = 1000e18;

    address internal bit2cHot = makeAddr("bit2cHotWallet");
    address internal wKyc = makeAddr("W_kyc");
    address internal relayer = makeAddr("relayer");

    function setUp() public override {
        super.setUp();
        exit = d.exitAssurance;

        d.verifier.setVerifier(EXIT_PATTERN, IGroth16Verifier(address(d.groth16)));
        d.dkim.setKey(BIT2C, dkimKeyOf(BIT2C), 0, 0);
        hasher = _deployHasher();
        withdrawMock = new MockGroth16Verifier();

        pool = new ProvenanceShieldedPool(
            d.usd, exit, d.verifier, IGroth16Verifier(address(withdrawMock)), hasher,
            DENOM, EXIT_PATTERN, 1, 20, address(this)
        );
        pool.setRampDomain(BIT2C, true);
        exit.setPool(address(pool));
    }

    /// Deploy the circomlib Poseidon(2) hasher from its EVM bytecode.
    function _deployHasher() internal returns (IHasher h) {
        bytes memory code = vm.parseBytes(vm.readFile("test/poseidon2_bytecode.txt"));
        address a;
        assembly {
            a := create(0, add(code, 0x20), mload(code))
        }
        require(a != address(0), "hasher deploy failed");
        return IHasher(a);
    }

    function _voucherProof(string memory seed) internal view returns (EmailProof memory) {
        return mkProof(BIT2C, EXIT_PATTERN, emailNullifier(seed), uint64(block.timestamp));
    }

    function _bit2cPayout(address to) internal {
        mintUsd(bit2cHot, DENOM);
        vm.prank(bit2cHot);
        d.usd.transfer(to, DENOM);
    }

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

    function _depositOnce(address depositor, string memory vseed, uint256 commitment)
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
        _depositOnce(wKyc, "d1", 101);
        assertEq(pool.depositCount(), 1);
        assertTrue(pool.voucherSpent(emailNullifier("d1")));
        assertEq(d.usd.balanceOf(address(pool)), DENOM, "pool custodies the denomination");
    }

    function test_deposit_reusedVoucher_reverts() public {
        bytes32 nf = _depositOnce(wKyc, "d1", 101);
        _bit2cPayout(wKyc);
        vm.startPrank(wKyc);
        d.usd.approve(address(pool), DENOM);
        vm.expectRevert(ProvenanceShieldedPool.VoucherUnknown.selector);
        pool.deposit(nf, 102);
        vm.stopPrank();
    }

    function test_deposit_duplicateCommitment_reverts() public {
        _depositOnce(wKyc, "d1", 777);
        pool.mintVoucher(_voucherProof("d2"));
        _bit2cPayout(wKyc);
        vm.startPrank(wKyc);
        d.usd.approve(address(pool), DENOM);
        vm.expectRevert(ProvenanceShieldedPool.CommitmentExists.selector);
        pool.deposit(emailNullifier("d2"), 777);
        vm.stopPrank();
    }

    function _withdraw(uint256 nfPool, uint256 fee) internal {
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: relayer, fee: fee});
        uint256[8] memory proof;
        uint256 root = pool.getLastRoot();
        vm.prank(relayer);
        pool.withdraw(proof, root, nfPool, ext);
    }

    function test_withdraw_creditsExitIndex_paysRelayer_keyedByNullifier() public {
        _depositOnce(wKyc, "d1", 101);
        uint256 nfPool = 424242;
        uint256 fee = 5e18;
        _withdraw(nfPool, fee);

        assertTrue(pool.nullifierSpent(nfPool), "pool nullifier spent");
        assertEq(d.usd.balanceOf(relayer), fee, "relayer paid its bound fee");
        assertEq(exit.exitIndex(), DENOM - fee, "exit index credited (denom - fee)");
        assertEq(exit.exited(bytes32(nfPool)), DENOM - fee, "credited to the ANONYMOUS nullifier");
        assertEq(exit.totalExited(), d.usd.balanceOf(address(exit)), "stock invariant holds");
    }

    function test_withdraw_belowMinDeposits_reverts() public {
        pool.setMinDeposits(2);
        _depositOnce(wKyc, "d1", 101);
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: relayer, fee: 0});
        uint256[8] memory proof;
        uint256 root = pool.getLastRoot();
        vm.prank(relayer);
        vm.expectRevert(ProvenanceShieldedPool.TooFewDeposits.selector);
        pool.withdraw(proof, root, 1, ext);
    }

    function test_withdraw_doubleSpend_reverts() public {
        _depositOnce(wKyc, "d1", 101);
        _depositOnce(makeAddr("kyc2"), "d2", 102);
        uint256 nfPool = 424242;
        _withdraw(nfPool, 0);
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: relayer, fee: 0});
        uint256[8] memory proof;
        uint256 root = pool.getLastRoot();
        vm.prank(relayer);
        vm.expectRevert(ProvenanceShieldedPool.NullifierUsed.selector);
        pool.withdraw(proof, root, nfPool, ext);
    }

    function test_withdraw_unknownRoot_reverts() public {
        _depositOnce(wKyc, "d1", 101);
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: relayer, fee: 0});
        uint256[8] memory proof;
        vm.prank(relayer);
        vm.expectRevert(ProvenanceShieldedPool.UnknownRoot.selector);
        pool.withdraw(proof, 99999, 1, ext);
    }

    function test_withdraw_badProof_reverts() public {
        _depositOnce(wKyc, "d1", 101);
        withdrawMock.setResult(false);
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: relayer, fee: 0});
        uint256[8] memory proof;
        uint256 root = pool.getLastRoot();
        vm.prank(relayer);
        vm.expectRevert(ProvenanceShieldedPool.InvalidProof.selector);
        pool.withdraw(proof, root, 1, ext);
    }

    function test_unlinkability_noEventTiesKycToExit() public {
        _depositOnce(wKyc, "d1", 101);
        uint256 nfPool = 424242;

        vm.recordLogs();
        _withdraw(nfPool, 2e18);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bytes32 kycWord = bytes32(uint256(uint160(wKyc)));
        for (uint256 i = 0; i < logs.length; i++) {
            for (uint256 t = 0; t < logs[i].topics.length; t++) {
                assertTrue(logs[i].topics[t] != kycWord, "W_kyc leaked into a withdraw topic");
            }
            assertFalse(_dataHas(logs[i].data, kycWord), "W_kyc leaked into withdraw data");
        }
        assertEq(exit.exited(bytes32(nfPool)), DENOM - 2e18);
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

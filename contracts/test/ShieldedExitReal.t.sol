// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {Community, EmailProof} from "../src/Types.sol";
import {ExitAssurance} from "../src/ExitAssurance.sol";
import {ProvenanceShieldedPool} from "../src/ProvenanceShieldedPool.sol";
import {IHasher} from "../src/lib/MerkleTreeWithHistory.sol";
import {IGroth16Verifier} from "../src/interfaces/IGroth16Verifier.sol";
import {WithdrawGroth16Verifier} from "../src/verifiers/WithdrawGroth16Verifier.sol";
import {WithdrawVerifierAdapter} from "../src/verifiers/WithdrawVerifierAdapter.sol";

/// @notice The REAL zero-knowledge withdrawal — no mock. A commitment is inserted into
///         the on-chain Poseidon tree, and a genuine Groth16 Merkle-membership proof
///         (zk/withdraw.circom, produced by zk/gen-proof.mjs and stored in
///         test/withdraw-fixture.json) is verified on-chain by the compiled snarkjs
///         verifier. This is the load-bearing anonymity circuit: with it, the withdrawal
///         reveals only a nullifier and cannot be tied to the deposit.
///
///         The two assertions that matter:
///           1. the on-chain Poseidon tree's root equals the circuit's root (the tree
///              and the circuit hash identically), and
///           2. the real proof verifies and credits ExitAssurance; a tampered proof does not.
contract ShieldedExitRealTest is BaseTest {
    ProvenanceShieldedPool internal pool;
    ExitAssurance internal exit;

    bytes32 internal constant EXIT_PATTERN = keccak256("p2peace/exit-receipt-v1");
    bytes32 internal constant BIT2C = keccak256("bit2c.co.il");
    uint256 internal constant DENOM = 1000e18;
    // The relayer + fee the fixture proof was bound to (zk/gen-proof.mjs).
    address internal constant BOUND_RELAYER = 0x000000000000000000000000000000000000c0DE;

    // fixture
    uint256 internal fCommitment;
    uint256 internal fRoot;
    uint256 internal fNullifierHash;
    uint256[8] internal fProof;

    function setUp() public override {
        super.setUp();
        exit = d.exitAssurance;

        d.verifier.setVerifier(EXIT_PATTERN, IGroth16Verifier(address(d.groth16)));
        d.dkim.setKey(BIT2C, dkimKeyOf(BIT2C), 0, 0);

        // Real Poseidon hasher + real Groth16 verifier + adapter.
        bytes memory code = vm.parseBytes(vm.readFile("test/poseidon2_bytecode.txt"));
        address h;
        assembly {
            h := create(0, add(code, 0x20), mload(code))
        }
        require(h != address(0), "hasher deploy failed");
        WithdrawGroth16Verifier g16 = new WithdrawGroth16Verifier();
        WithdrawVerifierAdapter adapter = new WithdrawVerifierAdapter(g16);

        pool = new ProvenanceShieldedPool(
            d.usd, exit, d.verifier, IGroth16Verifier(address(adapter)), IHasher(h),
            DENOM, EXIT_PATTERN, 1, 20, address(this)
        );
        pool.setRampDomain(BIT2C, true);
        exit.setPool(address(pool));

        string memory j = vm.readFile("test/withdraw-fixture.json");
        fCommitment = vm.parseJsonUint(j, ".commitment");
        fRoot = vm.parseJsonUint(j, ".root");
        fNullifierHash = vm.parseJsonUint(j, ".nullifierHash");
        uint256[] memory p = vm.parseJsonUintArray(j, ".proof8");
        for (uint256 i = 0; i < 8; i++) fProof[i] = p[i];
    }

    function _deposit() internal {
        bytes32 exitNf = emailNullifier("real-1");
        pool.mintVoucher(mkProof(BIT2C, EXIT_PATTERN, exitNf, uint64(block.timestamp)));
        address wKyc = makeAddr("W_kyc");
        mintUsd(wKyc, DENOM);
        vm.startPrank(wKyc);
        d.usd.approve(address(pool), DENOM);
        pool.deposit(exitNf, fCommitment);
        vm.stopPrank();
    }

    /// The on-chain Poseidon tree must produce the SAME root the circuit proved against.
    function test_onchainTreeMatchesCircuitRoot() public {
        _deposit();
        assertEq(pool.getLastRoot(), fRoot, "on-chain Poseidon root == circuit root");
    }

    /// The real Groth16 proof verifies on-chain and credits the anonymous exit.
    function test_realProof_withdrawsAnonymously() public {
        _deposit();
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: BOUND_RELAYER, fee: 0});
        // submitted by an unrelated relayer address; recipient/fee are bound in the proof
        vm.prank(makeAddr("some-relayer"));
        pool.withdraw(fProof, fRoot, fNullifierHash, ext);

        assertTrue(pool.nullifierSpent(fNullifierHash), "nullifier spent");
        assertEq(exit.exitIndex(), DENOM, "exit index credited by a REAL zk proof");
        assertEq(exit.exited(bytes32(fNullifierHash)), DENOM, "credited to the anonymous nullifier");
    }

    /// A tampered proof must NOT verify — proves the mock is gone.
    function test_tamperedProof_reverts() public {
        _deposit();
        uint256[8] memory bad = fProof;
        bad[0] = bad[0] ^ 1;
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: BOUND_RELAYER, fee: 0});
        vm.prank(makeAddr("some-relayer"));
        vm.expectRevert(ProvenanceShieldedPool.InvalidProof.selector);
        pool.withdraw(bad, fRoot, fNullifierHash, ext);
    }

    /// Wrong extData (different relayer/fee) changes extDataHash → the bound proof fails.
    function test_wrongExtData_reverts() public {
        _deposit();
        ProvenanceShieldedPool.ExtData memory ext =
            ProvenanceShieldedPool.ExtData({relayer: makeAddr("attacker"), fee: 0});
        vm.prank(makeAddr("some-relayer"));
        vm.expectRevert(ProvenanceShieldedPool.InvalidProof.selector);
        pool.withdraw(fProof, fRoot, fNullifierHash, ext);
    }
}

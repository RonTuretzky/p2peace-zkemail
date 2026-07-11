// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {EmailProof} from "../src/Types.sol";
import {ProvenanceShieldedPool} from "../src/ProvenanceShieldedPool.sol";
import {IHasher} from "../src/lib/MerkleTreeWithHistory.sol";
import {IGroth16Verifier} from "../src/interfaces/IGroth16Verifier.sol";
import {MockGroth16Verifier} from "../src/mocks/MockGroth16Verifier.sol";
import {ProvenanceGroth16Verifier} from "../src/verifiers/ProvenanceGroth16Verifier.sol";
import {ProvenanceVerifierAdapter} from "../src/verifiers/ProvenanceVerifierAdapter.sol";

/// @notice The REAL zkEmail provenance gate — no mock. A genuine Groth16 proof over the
///         actual Bit2C DKIM signature (RSA-2048 + SHA-256 over the signed header,
///         zk/provenance.circom) is verified on-chain, minting a deposit voucher WITHOUT
///         revealing the email. The proof/public signals in test/provenance-fixture.json
///         were produced by zk/gen-prov-proof.mjs from the real Bit2C email; they reveal
///         nothing about its content, so committing them is safe.
contract ProvenanceRealTest is BaseTest {
    ProvenanceShieldedPool internal pool;

    uint256 internal constant DENOM = 1000e18;

    bytes32 internal fPubkeyHash;
    bytes32 internal fDomainHash;
    bytes32 internal fNullifier;
    bytes32 internal fPatternHash;
    uint64 internal fTimestamp;
    uint256[8] internal fProof;

    function setUp() public override {
        super.setUp();

        string memory j = vm.readFile("test/provenance-fixture.json");
        fPubkeyHash = bytes32(vm.parseJsonUint(j, ".pubkeyHash"));
        fDomainHash = bytes32(vm.parseJsonUint(j, ".domainHash"));
        fNullifier = bytes32(vm.parseJsonUint(j, ".nullifier"));
        fPatternHash = bytes32(vm.parseJsonUint(j, ".patternHash"));
        fTimestamp = uint64(vm.parseJsonUint(j, ".emailTimestamp"));
        uint256[] memory p = vm.parseJsonUintArray(j, ".proof8");
        for (uint256 i = 0; i < 8; i++) fProof[i] = p[i];

        // Wire the REAL provenance verifier into ZKEmailVerifier under the pattern, and
        // register Bit2C's real key hash (from the proof) in the DKIM registry.
        ProvenanceGroth16Verifier g16 = new ProvenanceGroth16Verifier();
        ProvenanceVerifierAdapter adapter = new ProvenanceVerifierAdapter(g16);
        d.verifier.setVerifier(fPatternHash, IGroth16Verifier(address(adapter)));
        d.dkim.setKey(fDomainHash, fPubkeyHash, 0, 0);

        // Pool with the field-reduced pattern + a Poseidon hasher (withdraw path unused here).
        bytes memory code = vm.parseBytes(vm.readFile("test/poseidon2_bytecode.txt"));
        address h;
        assembly {
            h := create(0, add(code, 0x20), mload(code))
        }
        pool = new ProvenanceShieldedPool(
            d.usd, d.exitAssurance, d.verifier, IGroth16Verifier(address(new MockGroth16Verifier())),
            IHasher(h), DENOM, fPatternHash, 1, 20, address(this)
        );
        pool.setRampDomain(fDomainHash, true);
    }

    function _emailProof() internal view returns (EmailProof memory p) {
        p.dkimPubkeyHash = fPubkeyHash;
        p.domainHash = fDomainHash;
        p.nullifier = fNullifier;
        p.patternHash = fPatternHash;
        p.emailTimestamp = fTimestamp;
        p.proof = fProof;
    }

    /// The real Bit2C DKIM proof verifies on-chain and mints a voucher — email private.
    function test_realBit2CProof_mintsVoucher() public {
        pool.mintVoucher(_emailProof());
        assertTrue(pool.voucher(fNullifier), "voucher minted from a REAL zkEmail proof");
    }

    /// The same physical email can't be reused (per-email nullifier).
    function test_realProof_replay_reverts() public {
        pool.mintVoucher(_emailProof());
        vm.expectRevert(ProvenanceShieldedPool.VoucherUsed.selector);
        pool.mintVoucher(_emailProof());
    }

    /// A tampered proof does not verify — the mock is gone.
    function test_tamperedProof_reverts() public {
        EmailProof memory p = _emailProof();
        p.proof[0] = p.proof[0] ^ 1;
        vm.expectRevert(ProvenanceShieldedPool.InvalidProof.selector);
        pool.mintVoucher(p);
    }

    /// A forged pubkeyHash (claiming a key the proof wasn't made for) fails: the public
    /// input no longer matches what the circuit committed to.
    function test_forgedPubkeyHash_reverts() public {
        EmailProof memory p = _emailProof();
        p.dkimPubkeyHash = bytes32(uint256(p.dkimPubkeyHash) ^ 1);
        // register the forged (domain,key) so isKeyValid passes and we reach the verifier
        d.dkim.setKey(fDomainHash, p.dkimPubkeyHash, 0, 0);
        vm.expectRevert(ProvenanceShieldedPool.InvalidProof.selector);
        pool.mintVoucher(p);
    }
}

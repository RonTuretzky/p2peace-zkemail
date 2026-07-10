// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {RealEmailVerifier} from "../src/RealEmailVerifier.sol";
import {RSAPKCS1} from "../src/RSAPKCS1.sol";

/// @notice Verifies the REAL DKIM signature from an actual btl-gov-il one-time-code
///         email (sent via Amazon SES, From noreply at btl.gov.il). The vectors in
///         test/dkim-test-vector.json were extracted from the user's `.eml` and
///         confirmed valid off-chain (sig^e mod n == PKCS1(sha256(headers))). If
///         this test passes, the on-chain RSA path genuinely verifies that email.
contract RealEmailTest is Test {
    RealEmailVerifier internal verifier;

    // Loaded from the JSON vector in setUp().
    bytes internal signedHeaders;
    bytes internal signature;
    bytes internal modulus;
    bytes internal exponent = hex"010001"; // 65537

    string internal constant DOMAIN = "btl.gov.il";
    string internal constant SELECTOR = "testsel";

    function setUp() public {
        verifier = new RealEmailVerifier(address(this));
        string memory json = vm.readFile("test/dkim-test-vector.json");
        signedHeaders = vm.parseJsonBytes(json, ".signedData");
        signature = vm.parseJsonBytes(json, ".signature");
        modulus = vm.parseJsonBytes(json, ".modulus");
    }

    function test_realEmail_rsaVerifies() public view {
        assertTrue(
            RSAPKCS1.verify(signedHeaders, signature, exponent, modulus),
            "real btl.gov.il email signature must verify"
        );
    }

    function test_realEmail_wrongMessageFails() public view {
        bytes memory tampered = bytes.concat(signedHeaders, hex"00");
        assertFalse(
            RSAPKCS1.verify(tampered, signature, exponent, modulus),
            "tampered headers must not verify"
        );
    }

    function test_realEmail_registerAndVerifyIdentity() public {
        bytes32 id = verifier.registerKey(DOMAIN, SELECTOR, modulus, exponent);

        // Full identity path: verifies the signature and requires the signed
        // `from:` header to be the government sender.
        bytes32 nullifier =
            verifier.verifyIdentityEmail(id, signedHeaders, signature, "noreply@btl.gov.il");
        assertTrue(nullifier != bytes32(0), "nullifier derived from signed recipient");

        // Same email → same nullifier (deterministic, one identity per inbox).
        bytes32 again =
            verifier.verifyIdentityEmail(id, signedHeaders, signature, "noreply@btl.gov.il");
        assertEq(nullifier, again);
    }

    function test_realEmail_wrongFromReverts() public {
        bytes32 id = verifier.registerKey(DOMAIN, SELECTOR, modulus, exponent);
        vm.expectRevert(RealEmailVerifier.HeaderNotFound.selector);
        verifier.verifyIdentityEmail(id, signedHeaders, signature, "attacker@evil.example");
    }

    function test_realEmail_revokedKeyReverts() public {
        bytes32 id = verifier.registerKey(DOMAIN, SELECTOR, modulus, exponent);
        verifier.revokeKey(id);
        vm.expectRevert(RealEmailVerifier.RevokedKey.selector);
        verifier.verifySignature(id, signedHeaders, signature);
    }

    function test_realEmail_badSignatureReverts() public {
        bytes32 id = verifier.registerKey(DOMAIN, SELECTOR, modulus, exponent);
        bytes memory bad = signature;
        bad[100] = bytes1(uint8(bad[100]) ^ 0x01);
        vm.expectRevert(RealEmailVerifier.BadSignature.selector);
        verifier.verifySignature(id, signedHeaders, bad);
    }
}


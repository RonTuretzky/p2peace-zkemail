// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ExitReceiptVerifier} from "../src/ExitReceiptVerifier.sol";

/// @notice On-chain verification of a DKIM-signed conversion receipt: the RSA
///         signature, the SHA-256/base64 body hash (so the amount + destination
///         address in the body are covered), the From binding, and the destination
///         ADDRESS binding (the receipt is not a bearer instrument). Vectors are the
///         synthetic self-signed receipt in test/exit-receipt-vector.json.
contract ExitReceiptTest is Test {
    ExitReceiptVerifier internal verifier;

    bytes internal signedHeaders;
    bytes internal signature;
    bytes internal body;
    bytes internal modulus;
    bytes internal exponent;

    string internal constant DOMAIN = "bit2c-demo.example";
    string internal constant SELECTOR = "s1";
    string internal constant FROM = "info@bit2c-demo.example";
    address internal constant DEST = 0x1111111111111111111111111111111111111111;

    bytes32 internal id;

    function setUp() public {
        verifier = new ExitReceiptVerifier(address(this));
        string memory json = vm.readFile("test/exit-receipt-vector.json");
        signedHeaders = vm.parseJsonBytes(json, ".signedData");
        signature = vm.parseJsonBytes(json, ".signature");
        body = vm.parseJsonBytes(json, ".body");
        modulus = vm.parseJsonBytes(json, ".modulus");
        exponent = vm.parseJsonBytes(json, ".exponent");
        id = verifier.registerKey(DOMAIN, SELECTOR, modulus, exponent);
    }

    function test_validReceipt_bindsQPSplitAddress() public view {
        // The address in the body is split by a quoted-printable soft break, exactly
        // like the real Bit2C receipt; the verifier reassembles + binds it.
        (bytes32 nullifier, uint256 amt) =
            verifier.verifyReceipt(id, signedHeaders, signature, body, FROM, DEST);
        assertTrue(nullifier != bytes32(0), "receipt nullifier derived, QP-split address bound");
        assertEq(amt, 0, "no ILS marker in a real-format receipt (amount is best-effort)");
    }

    function test_deterministicNullifier() public view {
        (bytes32 a,) = verifier.verifyReceipt(id, signedHeaders, signature, body, FROM, DEST);
        (bytes32 b,) = verifier.verifyReceipt(id, signedHeaders, signature, body, FROM, DEST);
        assertEq(a, b, "same receipt -> same nullifier (dedup key)");
    }

    function test_wrongAddress_reverts() public {
        vm.expectRevert(ExitReceiptVerifier.AddressMismatch.selector);
        // Anyone but the address named in the signed body cannot claim the receipt.
        verifier.verifyReceipt(id, signedHeaders, signature, body, FROM, address(0xBEEF));
    }

    function test_wrongFrom_reverts() public {
        vm.expectRevert(ExitReceiptVerifier.HeaderNotFound.selector);
        verifier.verifyReceipt(id, signedHeaders, signature, body, "noreply@evil.example", DEST);
    }

    function test_tamperedSignature_reverts() public {
        bytes memory bad = signature;
        bad[100] = bytes1(uint8(bad[100]) ^ 0x01);
        vm.expectRevert(ExitReceiptVerifier.BadSignature.selector);
        verifier.verifyReceipt(id, signedHeaders, bad, body, FROM, DEST);
    }

    function test_tamperedBody_reverts() public {
        // Flip a byte in the body → its SHA-256 no longer matches the signed bh=.
        bytes memory badBody = body;
        badBody[0] = bytes1(uint8(badBody[0]) ^ 0x01);
        vm.expectRevert(ExitReceiptVerifier.BodyHashMismatch.selector);
        verifier.verifyReceipt(id, signedHeaders, signature, badBody, FROM, DEST);
    }

    function test_forgedAddressInBody_reverts() public {
        // Change a digit of the destination address in the body. The body no longer
        // hashes to the signed bh=, so the swap is rejected: the address is genuinely
        // under the signature, not free-text an attacker can rewrite to their wallet.
        bytes memory badBody = body;
        uint256 i = _find(badBody, "0x");
        require(i != type(uint256).max, "address present");
        badBody[i + 2] = badBody[i + 2] == bytes1("2") ? bytes1("3") : bytes1("2");
        vm.expectRevert(ExitReceiptVerifier.BodyHashMismatch.selector);
        verifier.verifyReceipt(id, signedHeaders, signature, badBody, FROM, DEST);
    }

    function test_revokedKey_reverts() public {
        verifier.revokeKey(id);
        vm.expectRevert(ExitReceiptVerifier.RevokedKey.selector);
        verifier.verifyReceipt(id, signedHeaders, signature, body, FROM, DEST);
    }

    function _find(bytes memory hay, bytes memory needle) internal pure returns (uint256) {
        for (uint256 i = 0; i + needle.length <= hay.length; i++) {
            bool ok = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (hay[i + j] != needle[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return i;
        }
        return type(uint256).max;
    }
}

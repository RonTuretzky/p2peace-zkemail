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

    string internal constant DOMAIN = "ramp.example";
    string internal constant SELECTOR = "exitsel";
    string internal constant FROM = "noreply@ramp.example";
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

    function test_validReceipt_bindsAddress_and_readsAmount() public view {
        (bytes32 nullifier, uint256 ils) =
            verifier.verifyReceipt(id, signedHeaders, signature, body, FROM, DEST);
        assertTrue(nullifier != bytes32(0), "receipt nullifier derived");
        assertEq(ils, 10000, "ILS amount read from signed body");
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

    function test_forgedAmountInBody_reverts() public {
        // Change the ILS amount in the body from 10000 → 90000 (first digit 1→9). The
        // body no longer hashes to the signed bh=, so the forgery is rejected: the
        // amount is genuinely under the signature, not free-text.
        bytes memory badBody = body;
        uint256 i = _find(badBody, "p2peace-exit-ils=1");
        require(i != type(uint256).max, "marker present");
        badBody[i + 17] = bytes1("9"); // the '1' right after '='
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

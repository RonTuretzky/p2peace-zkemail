// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {RealEmailVerifier} from "../src/RealEmailVerifier.sol";
import {IZKEmailVerifier} from "../src/interfaces/IZKEmailVerifier.sol";
import {Community} from "../src/Types.sol";

/// @notice End-to-end: register a real btl.gov.il email into IdentityRegistry via
///         the fully-on-chain DKIM path (no mock, no ZK).
contract RealRegisterTest is Test {
    IdentityRegistry internal identity;
    RealEmailVerifier internal real_;
    bytes internal signedHeaders;
    bytes internal signature;
    bytes internal modulus;
    bytes internal exponent = hex"010001";
    bytes32 internal kid;

    address internal alice = makeAddr("alice");

    function setUp() public {
        // IdentityRegistry needs a ZK verifier for its constructor; the real path
        // doesn't use it, so a dummy address is fine here.
        identity = new IdentityRegistry(address(this), IZKEmailVerifier(address(0xdead)));
        real_ = new RealEmailVerifier(address(this));

        string memory json = vm.readFile("test/dkim-test-vector.json");
        signedHeaders = vm.parseJsonBytes(json, ".signedData");
        signature = vm.parseJsonBytes(json, ".signature");
        modulus = vm.parseJsonBytes(json, ".modulus");

        kid = real_.registerKey(
            "amazonses.com", "gnjxqy3qktftol7iix6l5kvifzbvm3c5", modulus, exponent
        );
        identity.setRealVerifier(real_);
        identity.setRealKey(kid, Community.A, "noreply@btl.gov.il");
    }

    function test_registerReal_enrollsFromRealEmail() public {
        identity.registerReal(kid, signedHeaders, signature, alice);
        assertTrue(identity.isActiveMember(alice), "alice enrolled from her real email");
        assertEq(uint8(identity.communityOf(alice)), uint8(Community.A));
        assertTrue(identity.nullifierOf(alice) != bytes32(0));
    }

    function test_registerReal_rejectsUnmappedKey() public {
        vm.expectRevert(IdentityRegistry.RealKeyNotMapped.selector);
        identity.registerReal(bytes32(uint256(1)), signedHeaders, signature, alice);
    }

    function test_registerReal_rejectsBadSignature() public {
        bytes memory bad = signature;
        bad[10] = bytes1(uint8(bad[10]) ^ 0x02);
        vm.expectRevert(RealEmailVerifier.BadSignature.selector);
        identity.registerReal(kid, signedHeaders, bad, alice);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {RSAPKCS1} from "./RSAPKCS1.sol";

/// @notice Fully on-chain DKIM verification for *real* emails — no zero-knowledge,
///         no mock. Given the canonicalized signed headers of an email plus its RSA
///         signature, this contract proves the email was genuinely signed by a
///         registered domain key, then reads the `from:` and `to:` headers straight
///         out of the signed bytes.
///
///         This is the "verify my actual email" path. It is honest about its cost:
///         the signed headers (including the recipient's address) are public
///         calldata, so this proves authenticity but NOT privacy. The zkEmail
///         circuit path proves the same statement while keeping the email private;
///         that is the production upgrade (see circuits/). This contract exists so
///         the mechanism can be exercised end-to-end with a real inbox today.
contract RealEmailVerifier is Ownable {
    struct DomainKey {
        bool exists;
        bytes modulus; // RSA n, big-endian
        bytes exponent; // RSA e, big-endian (usually 0x010001)
        uint64 addedAt;
        uint64 revokedAt;
    }

    /// keyId = keccak256(domain ‖ selector). One RSA key per DKIM selector.
    mapping(bytes32 keyId => DomainKey) public keys;

    event KeyRegistered(bytes32 indexed keyId, string domain, string selector);
    event KeyRevoked(bytes32 indexed keyId);

    error UnknownKey();
    error RevokedKey();
    error BadSignature();
    error HeaderNotFound();

    constructor(address owner_) Ownable(owner_) {}

    function keyId(string calldata domain, string calldata selector) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(domain, ":", selector));
    }

    /// @notice Register a real DKIM public key (from DNS, or an archived historical
    ///         key when the domain has rotated it out of DNS — exactly the case that
    ///         motivates the key archive). Governance/timelock in production.
    function registerKey(
        string calldata domain,
        string calldata selector,
        bytes calldata modulus,
        bytes calldata exponent
    ) external onlyOwner returns (bytes32 id) {
        id = keyId(domain, selector);
        keys[id] = DomainKey({
            exists: true,
            modulus: modulus,
            exponent: exponent,
            addedAt: uint64(block.timestamp),
            revokedAt: 0
        });
        emit KeyRegistered(id, domain, selector);
    }

    function revokeKey(bytes32 id) external onlyOwner {
        if (!keys[id].exists) revert UnknownKey();
        keys[id].revokedAt = uint64(block.timestamp);
        emit KeyRevoked(id);
    }

    /// @notice Verify that `signedHeaders` carries a valid RSA signature from the
    ///         registered key `id`. Reverts on any failure; returns on success.
    function verifySignature(bytes32 id, bytes calldata signedHeaders, bytes calldata signature)
        public
        view
    {
        DomainKey storage dk = keys[id];
        if (!dk.exists) revert UnknownKey();
        if (dk.revokedAt != 0) revert RevokedKey();
        if (!RSAPKCS1.verify(signedHeaders, signature, dk.exponent, dk.modulus)) {
            revert BadSignature();
        }
    }

    /// @notice Full verification for identity: check the signature, require the
    ///         `from:` header to equal `expectedFrom` (the government sender address),
    ///         and return a nullifier derived from the `to:` recipient — all read
    ///         from the cryptographically-signed bytes, so none of it can be forged
    ///         without the domain's private key. Freshness (the signed Date) is
    ///         enforced off-chain by the caller against block time.
    /// @return nullifier keccak256("p2peace-real-id" concat recipientBytes)
    function verifyIdentityEmail(
        bytes32 id,
        bytes calldata signedHeaders,
        bytes calldata signature,
        string calldata expectedFrom
    ) external view returns (bytes32 nullifier) {
        verifySignature(id, signedHeaders, signature);

        // `from:` is always a DKIM-signed header. Require the sender ADDRESS to be
        // the allowlisted government sender. Mailers render From either as a bare
        // address (`from:noreply@btl.gov.il`) or, with a display name, angle-
        // bracketed (`from:=?UTF-8?..?= <noreply@btl.gov.il>`). Match the address in
        // the From value so a spoofed display name can't smuggle a different sender.
        bytes memory fromValue = _extractHeaderValue(signedHeaders, "from:");
        bytes memory bracketed = bytes.concat("<", bytes(expectedFrom), ">");
        if (!_equals(fromValue, bytes(expectedFrom)) && !_bytesContains(fromValue, bracketed)) {
            revert HeaderNotFound();
        }

        // Extract the `to:` recipient value → nullifier. Relaxed canonicalization
        // renders it as `to:<value>\r\n`, lowercased header name.
        bytes memory recipient = _extractHeaderValue(signedHeaders, "to:");
        nullifier = keccak256(bytes.concat("p2peace-real-id", recipient));
    }

    // --------------------------------------------------------------- byte helpers

    /// @dev Return the value of the first relaxed-canonicalized header line whose
    ///      name (lowercase, e.g. "to:") matches, up to the terminating CRLF/LF.
    function _extractHeaderValue(bytes calldata data, bytes memory name)
        internal
        pure
        returns (bytes memory)
    {
        uint256 start = _indexOf(data, name, 0);
        if (start == type(uint256).max) revert HeaderNotFound();
        // header names begin a line: index 0 or preceded by \n
        while (start != 0 && data[start - 1] != 0x0a) {
            start = _indexOf(data, name, start + 1);
            if (start == type(uint256).max) revert HeaderNotFound();
        }
        uint256 vStart = start + name.length;
        uint256 vEnd = vStart;
        while (vEnd < data.length && data[vEnd] != 0x0d && data[vEnd] != 0x0a) {
            vEnd++;
        }
        bytes memory out = new bytes(vEnd - vStart);
        for (uint256 i = 0; i < out.length; i++) {
            out[i] = data[vStart + i];
        }
        return out;
    }

    function _equals(bytes memory a, bytes memory b) internal pure returns (bool) {
        return a.length == b.length && keccak256(a) == keccak256(b);
    }

    /// @dev substring search over two `memory` byte arrays.
    function _bytesContains(bytes memory hay, bytes memory needle) internal pure returns (bool) {
        uint256 n = needle.length;
        if (n == 0 || hay.length < n) return false;
        for (uint256 i = 0; i + n <= hay.length; i++) {
            bool ok = true;
            for (uint256 j = 0; j < n; j++) {
                if (hay[i + j] != needle[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }

    function _indexOf(bytes calldata data, bytes memory needle, uint256 from)
        internal
        pure
        returns (uint256)
    {
        uint256 n = needle.length;
        if (n == 0 || data.length < n) return type(uint256).max;
        for (uint256 i = from; i + n <= data.length; i++) {
            bool ok = true;
            for (uint256 j = 0; j < n; j++) {
                if (data[i + j] != needle[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return i;
        }
        return type(uint256).max;
    }
}

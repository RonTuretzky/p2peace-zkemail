// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {RSAPKCS1} from "./RSAPKCS1.sol";

/// @notice Fully on-chain DKIM verification of a *conversion receipt* — the email a
///         regulated ramp / exchange sends when it converts national currency (ILS)
///         into a non-shekel asset and sends it to an on-chain address. This is the
///         PROVENANCE half of the exit mechanism: it proves a named sender genuinely
///         asserted "we converted X ILS and sent it to address A", and it binds that
///         address into the proof so the receipt is NOT a bearer instrument (it can
///         only ever be claimed by A). It is the sound form of "put the destination
///         address in the signed email" — see docs/CURRENCY-MECHANISM.md.
///
///         HONEST SCOPE. This proves AUTHENTICITY of one gross, single-venue
///         conversion *claim*, cryptographically bound to a destination address. It
///         does NOT prove net exit: a valid receipt survives round-tripping,
///         borrowed-ILS funding, and pre-owned-stablecoin deposits (the input side is
///         unobservable). The load-bearing accounting is therefore always the on-chain
///         sDAI *stock* in ExitAssurance; this receipt only decorates a position with
///         tamper-proof shekel-provenance, and is reported as a separate number.
///
///         Two further honesty notes carried from the research:
///         (1) No Israeli ramp today emits a receipt that puts a FULL 0x address +
///             amount in the DKIM-signed body, and none settles natively on Gnosis, so
///             the extraction regex is per-sender and this path is contingent until a
///             conforming sender exists. The synthetic test vector proves the machine.
///         (2) The signed headers/body (incl. the address) are public calldata — this
///             is the non-private tier, exactly like RealEmailVerifier. The ZK tier
///             folds a wallet secret into the nullifier to avoid the sender
///             de-anonymizing the on-chain proof.
contract ExitReceiptVerifier is Ownable {
    using RSAPKCS1 for bytes;

    struct DomainKey {
        bool exists;
        bytes modulus; // RSA n, big-endian
        bytes exponent; // RSA e, big-endian (usually 0x010001)
        uint64 addedAt;
        uint64 revokedAt;
    }

    /// keyId = keccak256(domain ‖ ":" ‖ selector). One RSA key per DKIM selector.
    mapping(bytes32 keyId => DomainKey) public keys;

    // Machine-readable markers the ramp is required to place in the signed body.
    // Real senders won't use these exact markers — the regex is per-sender; these
    // define the interoperable convention a conforming/adapter sender targets.
    bytes internal constant ADDR_MARKER = "p2peace-exit-address=0x";
    bytes internal constant ILS_MARKER = "p2peace-exit-ils=";

    event KeyRegistered(bytes32 indexed keyId, string domain, string selector);
    event KeyRevoked(bytes32 indexed keyId);

    error UnknownKey();
    error RevokedKey();
    error BadSignature();
    error HeaderNotFound();
    error BodyHashMismatch();
    error AddressNotFound();
    error AddressMismatch();

    constructor(address owner_) Ownable(owner_) {}

    function keyId(string calldata domain, string calldata selector) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(domain, ":", selector));
    }

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

    /// @notice Verify a conversion receipt fully on-chain.
    ///         1. RSA-verify the DKIM signature over `signedHeaders`.
    ///         2. Require the signed `from:` to carry `expectedFrom` (the ramp).
    ///         3. Verify `body` against the signed `bh=` body hash (SHA-256, base64),
    ///            so the amount + destination address in the body are covered by the
    ///            signature and cannot be altered.
    ///         4. Extract the destination address from the signed body and require it
    ///            to equal `expectedAddress` (the claiming member's wallet) — the
    ///            not-a-bearer-instrument binding.
    /// @return nullifier per-receipt id (one credit per physical email)
    /// @return ilsAmount the ILS amount asserted in the receipt (presentational)
    function verifyReceipt(
        bytes32 id,
        bytes calldata signedHeaders,
        bytes calldata signature,
        bytes calldata body,
        string calldata expectedFrom,
        address expectedAddress
    ) external view returns (bytes32 nullifier, uint256 ilsAmount) {
        DomainKey storage dk = keys[id];
        if (!dk.exists) revert UnknownKey();
        if (dk.revokedAt != 0) revert RevokedKey();
        if (!RSAPKCS1.verify(signedHeaders, signature, dk.exponent, dk.modulus)) {
            revert BadSignature();
        }

        // (2) sender binding: From must be (or contain, angle-bracketed) the ramp.
        bytes memory fromValue = _extractHeaderValue(signedHeaders, "from:");
        bytes memory bracketed = bytes.concat("<", bytes(expectedFrom), ">");
        if (!_equals(fromValue, bytes(expectedFrom)) && !_contains(fromValue, bracketed)) {
            revert HeaderNotFound();
        }

        // (3) body binding: base64(sha256(simpleCanon(body))) must equal the signed bh=.
        bytes memory bh = _extractTag(signedHeaders, "bh=");
        string memory computed = Base64.encode(bytes.concat(_simpleBodyHash(body)));
        if (keccak256(bytes(computed)) != keccak256(bh)) revert BodyHashMismatch();

        // (4) address binding: the address named in the signed body must be the claimer.
        address named = _extractAddress(body);
        if (named != expectedAddress) revert AddressMismatch();

        ilsAmount = _extractUint(body, ILS_MARKER);
        nullifier = keccak256(bytes.concat("p2peace-exit-receipt", signature));
    }

    // ------------------------------------------------------------- body hashing

    /// @dev DKIM "simple" body canonicalization: strip trailing empty lines to a
    ///      single terminating CRLF, then SHA-256. (An empty body hashes a lone CRLF.)
    function _simpleBodyHash(bytes calldata body) internal pure returns (bytes32) {
        uint256 end = body.length;
        while (end >= 2 && body[end - 2] == 0x0d && body[end - 1] == 0x0a) {
            end -= 2;
        }
        bytes memory canon = new bytes(end + 2);
        for (uint256 i = 0; i < end; i++) {
            canon[i] = body[i];
        }
        canon[end] = 0x0d;
        canon[end + 1] = 0x0a;
        return sha256(canon);
    }

    // --------------------------------------------------------------- extractors

    /// @dev Value of the first relaxed-canonicalized header line whose lowercase name
    ///      matches (e.g. "from:"), up to the terminating CRLF/LF.
    function _extractHeaderValue(bytes calldata data, bytes memory name)
        internal
        pure
        returns (bytes memory)
    {
        uint256 start = _indexOf(data, name, 0);
        if (start == type(uint256).max) revert HeaderNotFound();
        while (start != 0 && data[start - 1] != 0x0a) {
            start = _indexOf(data, name, start + 1);
            if (start == type(uint256).max) revert HeaderNotFound();
        }
        uint256 vStart = start + name.length;
        uint256 vEnd = vStart;
        while (vEnd < data.length && data[vEnd] != 0x0d && data[vEnd] != 0x0a) {
            vEnd++;
        }
        return _slice(data, vStart, vEnd);
    }

    /// @dev Value of a DKIM tag inside the signed headers (e.g. "bh="), read up to the
    ///      next ';' or line end. The base64 alphabet contains no ';', so this is exact.
    function _extractTag(bytes calldata data, bytes memory tag) internal pure returns (bytes memory) {
        uint256 start = _indexOf(data, tag, 0);
        if (start == type(uint256).max) revert HeaderNotFound();
        uint256 vStart = start + tag.length;
        uint256 vEnd = vStart;
        while (
            vEnd < data.length && data[vEnd] != 0x3b && data[vEnd] != 0x0d && data[vEnd] != 0x0a
                && data[vEnd] != 0x20
        ) {
            vEnd++;
        }
        return _slice(data, vStart, vEnd);
    }

    /// @dev Parse the 40-hex-char address that follows ADDR_MARKER ("...=0x") in the
    ///      signed body. Requires the FULL address (no truncation/masking).
    function _extractAddress(bytes calldata body) internal pure returns (address) {
        uint256 m = _indexOf(body, ADDR_MARKER, 0);
        if (m == type(uint256).max) revert AddressNotFound();
        uint256 p = m + ADDR_MARKER.length;
        if (p + 40 > body.length) revert AddressNotFound();
        uint160 acc = 0;
        for (uint256 i = 0; i < 40; i++) {
            acc = (acc << 4) | uint160(_hexVal(body[p + i]));
        }
        return address(acc);
    }

    /// @dev Parse the unsigned decimal that follows `marker` in the body (0 if absent).
    function _extractUint(bytes calldata body, bytes memory marker) internal pure returns (uint256) {
        uint256 m = _indexOf(body, marker, 0);
        if (m == type(uint256).max) return 0;
        uint256 p = m + marker.length;
        uint256 acc = 0;
        while (p < body.length && body[p] >= 0x30 && body[p] <= 0x39) {
            acc = acc * 10 + (uint8(body[p]) - 0x30);
            p++;
        }
        return acc;
    }

    function _hexVal(bytes1 c) internal pure returns (uint8) {
        uint8 x = uint8(c);
        if (x >= 0x30 && x <= 0x39) return x - 0x30; // 0-9
        if (x >= 0x61 && x <= 0x66) return x - 0x61 + 10; // a-f
        if (x >= 0x41 && x <= 0x46) return x - 0x41 + 10; // A-F
        revert AddressNotFound();
    }

    // ----------------------------------------------------------------- bytes utils

    function _slice(bytes calldata data, uint256 s, uint256 e) internal pure returns (bytes memory) {
        bytes memory out = new bytes(e - s);
        for (uint256 i = 0; i < out.length; i++) {
            out[i] = data[s + i];
        }
        return out;
    }

    function _equals(bytes memory a, bytes memory b) internal pure returns (bool) {
        return a.length == b.length && keccak256(a) == keccak256(b);
    }

    function _contains(bytes memory hay, bytes memory needle) internal pure returns (bool) {
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

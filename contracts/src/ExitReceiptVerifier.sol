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

    // Optional machine-readable amount marker (not required; real ramps like Bit2C
    // don't emit it, so amount is best-effort and never load-bearing).
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

        // (3) body binding: base64(sha256(relaxedCanon(body))) must equal the signed
        //     bh=. Bit2C (and most senders) use c=relaxed/relaxed; the body is signed
        //     as-transferred (quoted-printable), so we hash the raw body bytes.
        bytes memory bh = _extractTag(signedHeaders, "bh=");
        string memory computed = Base64.encode(bytes.concat(_relaxedBodyHash(body)));
        if (keccak256(bytes(computed)) != keccak256(bh)) revert BodyHashMismatch();

        // (4) address binding: the destination address in the signed body must be the
        //     claimer. Extracted tolerant of quoted-printable soft breaks (the address
        //     is often split, e.g. `...Cf24=\r\n21676946C`).
        address named = _extractAddressQP(body);
        if (named != expectedAddress) revert AddressMismatch();

        ilsAmount = _extractUint(body, ILS_MARKER);
        nullifier = keccak256(bytes.concat("p2peace-exit-receipt", signature));
    }

    // ------------------------------------------------------------- body hashing

    /// @dev DKIM "relaxed" body canonicalization (RFC 6376 §3.4.4), then SHA-256:
    ///      (a) strip trailing WSP at end of each line, (b) collapse WSP runs to a
    ///      single SP, (c) collapse trailing empty lines to one CRLF (and ensure the
    ///      body ends with a CRLF). Byte-exact with the reference — validated to
    ///      reproduce Bit2C's signed bh=.
    function _relaxedBodyHash(bytes calldata body) internal pure returns (bytes32) {
        uint256 n = body.length;
        bytes memory t = new bytes(n + 2); // output never grows past input (+CRLF)
        uint256 o = 0;
        bool pendingWsp = false;
        uint256 i = 0;
        while (i < n) {
            bytes1 c = body[i];
            if (c == 0x20 || c == 0x09) {
                pendingWsp = true; // (a)+(b): defer WSP; emit at most one SP
                i++;
                continue;
            }
            if (c == 0x0d && i + 1 < n && body[i + 1] == 0x0a) {
                pendingWsp = false; // drop trailing WSP before the CRLF
                t[o++] = 0x0d;
                t[o++] = 0x0a;
                i += 2;
                continue;
            }
            if (c == 0x0a) {
                pendingWsp = false; // tolerate a bare LF as a line end
                t[o++] = 0x0d;
                t[o++] = 0x0a;
                i++;
                continue;
            }
            if (pendingWsp) {
                t[o++] = 0x20;
                pendingWsp = false;
            }
            t[o++] = c;
            i++;
        }
        // (c) collapse trailing empty lines to a single CRLF...
        while (o >= 4 && t[o - 4] == 0x0d && t[o - 3] == 0x0a && t[o - 2] == 0x0d && t[o - 1] == 0x0a)
        {
            o -= 2;
        }
        // ...and ensure a non-empty body ends with exactly one CRLF.
        if (o == 0 || t[o - 1] != 0x0a) {
            t[o++] = 0x0d;
            t[o++] = 0x0a;
        }
        bytes memory canon = new bytes(o);
        for (uint256 k = 0; k < o; k++) {
            canon[k] = t[k];
        }
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

    /// @dev Extract the destination address from the signed body: the first "0x"
    ///      followed by 40 hex digits, tolerant of quoted-printable soft breaks
    ///      ("=\r\n" / "=\n") splitting the hex run. Because the whole body is already
    ///      committed by the bh= check, this parse only affects whether we can READ
    ///      Bit2C's address, never security — so scanning for the address is safe.
    function _extractAddressQP(bytes calldata body) internal pure returns (address) {
        uint256 m = _indexOf(body, "0x", 0);
        while (m != type(uint256).max) {
            (bool ok, address a) = _readHex40QP(body, m + 2);
            if (ok) return a;
            m = _indexOf(body, "0x", m + 2);
        }
        revert AddressNotFound();
    }

    /// @dev Try to read exactly 40 hex chars from `p`, skipping "=\r\n"/"=\n" soft
    ///      breaks. Returns (false, 0) if a non-hex, non-soft-break char appears first.
    function _readHex40QP(bytes calldata body, uint256 p) internal pure returns (bool, address) {
        uint160 acc = 0;
        uint256 got = 0;
        uint256 len = body.length;
        while (got < 40 && p < len) {
            bytes1 c = body[p];
            if (c == 0x3d) {
                // quoted-printable soft line break: "=\r\n" or "=\n"
                if (p + 2 < len && body[p + 1] == 0x0d && body[p + 2] == 0x0a) {
                    p += 3;
                    continue;
                }
                if (p + 1 < len && body[p + 1] == 0x0a) {
                    p += 2;
                    continue;
                }
                return (false, address(0));
            }
            uint8 v = _hexOrFF(c);
            if (v == 0xff) return (false, address(0));
            acc = (acc << 4) | uint160(v);
            got++;
            p++;
        }
        if (got == 40) return (true, address(acc));
        return (false, address(0));
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

    function _hexOrFF(bytes1 c) internal pure returns (uint8) {
        uint8 x = uint8(c);
        if (x >= 0x30 && x <= 0x39) return x - 0x30; // 0-9
        if (x >= 0x61 && x <= 0x66) return x - 0x61 + 10; // a-f
        if (x >= 0x41 && x <= 0x46) return x - 0x41 + 10; // A-F
        return 0xff;
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

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice RSASSA-PKCS1-v1.5 signature verification for SHA-256, using the EVM
///         modexp precompile (address 0x05). This is the real cryptographic core
///         behind DKIM: a signature `s` verifies iff `s^e mod n` decodes to the
///         PKCS#1 v1.5 encoding of `SHA256(message)`.
///
///         No zero-knowledge here — the message (email headers) is public. The ZK
///         path (compiled zkEmail circuits) proves the same statement while keeping
///         the email private; this library is the honest, fully-on-chain,
///         non-private counterpart used for the "verify my real email" flow.
library RSAPKCS1 {
    /// DigestInfo prefix for SHA-256 (RFC 8017 §9.2): the DER header that precedes
    /// the 32-byte hash inside the PKCS#1 v1.5 encoded message.
    bytes internal constant SHA256_PREFIX = hex"3031300d060960864801650304020105000420";

    error ModexpFailed();

    /// @param message the exact bytes that were signed (canonicalized DKIM headers)
    /// @param signature the RSA signature `s`, big-endian, length == modulus length
    /// @param exponent the public exponent `e` (typically 65537)
    /// @param modulus the RSA public modulus `n`, big-endian (256 bytes for RSA-2048)
    function verify(
        bytes memory message,
        bytes memory signature,
        bytes memory exponent,
        bytes memory modulus
    ) internal view returns (bool) {
        uint256 k = modulus.length;
        if (signature.length != k || k < 64) return false;

        // s^e mod n via the modexp precompile (0x05).
        bytes memory em = _modexp(signature, exponent, modulus);
        if (em.length != k) return false;

        // EMSA-PKCS1-v1.5 for SHA-256:
        //   0x00 0x01 0xFF...(>=8).. 0x00 || DigestInfo(19 bytes) || H(32 bytes)
        bytes32 h = sha256(message);
        uint256 tLen = SHA256_PREFIX.length + 32; // 19 + 32 = 51
        // Minimum padding: 00 01 [>=8 x FF] 00 -> at least 11 bytes of overhead.
        if (k < tLen + 11) return false;

        if (em[0] != 0x00 || em[1] != 0x01) return false;

        // 0xFF run from index 2 up to the 0x00 separator before DigestInfo.
        uint256 psEnd = k - tLen - 1; // index of the 0x00 separator
        for (uint256 i = 2; i < psEnd; i++) {
            if (em[i] != 0xff) return false;
        }
        if (em[psEnd] != 0x00) return false;

        // DigestInfo prefix.
        for (uint256 i = 0; i < SHA256_PREFIX.length; i++) {
            if (em[psEnd + 1 + i] != SHA256_PREFIX[i]) return false;
        }
        // The 32-byte digest.
        uint256 hStart = psEnd + 1 + SHA256_PREFIX.length;
        for (uint256 i = 0; i < 32; i++) {
            if (em[hStart + i] != h[i]) return false;
        }
        return true;
    }

    /// @dev Call the modexp precompile: returns base^exp mod mod, left-padded to
    ///      the modulus length.
    function _modexp(bytes memory base, bytes memory e, bytes memory m)
        private
        view
        returns (bytes memory out)
    {
        uint256 bLen = base.length;
        uint256 eLen = e.length;
        uint256 mLen = m.length;
        out = new bytes(mLen);

        bool ok;
        assembly {
            let p := mload(0x40)
            mstore(p, bLen)
            mstore(add(p, 0x20), eLen)
            mstore(add(p, 0x40), mLen)
            let dataPtr := add(p, 0x60)
            // copy base
            let src := add(base, 0x20)
            for { let i := 0 } lt(i, bLen) { i := add(i, 0x20) } {
                mstore(add(dataPtr, i), mload(add(src, i)))
            }
            dataPtr := add(dataPtr, bLen)
            src := add(e, 0x20)
            for { let i := 0 } lt(i, eLen) { i := add(i, 0x20) } {
                mstore(add(dataPtr, i), mload(add(src, i)))
            }
            dataPtr := add(dataPtr, eLen)
            src := add(m, 0x20)
            for { let i := 0 } lt(i, mLen) { i := add(i, 0x20) } {
                mstore(add(dataPtr, i), mload(add(src, i)))
            }
            let inLen := add(0x60, add(add(bLen, eLen), mLen))
            // staticcall precompile 0x05
            ok := staticcall(gas(), 0x05, p, inLen, add(out, 0x20), mLen)
        }
        if (!ok) revert ModexpFailed();
    }
}

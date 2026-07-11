pragma circom 2.1.6;

include "@zk-email/circuits/email-verifier.circom";
include "@zk-email/circuits/utils/hash.circom";

// Real zkEmail provenance: proves a genuine DKIM-signed email (RSA-2048 + SHA-256 over
// the signed header) WITHOUT revealing the email, and derives a per-email nullifier.
// The signing key's hash (pubkeyHash) is a public output; the on-chain DKIMRegistry
// binds (domainHash, pubkeyHash), so only a registered domain's real key passes.
//
// Public-signal order (circom emits OUTPUTS then PUBLIC INPUTS):
//   [pubkeyHash, nullifier, domainHash, patternHash, emailTimestamp, extraData]
// The on-chain adapter reorders these into the ZKEmailVerifier layout
//   [pubkeyHash, domainHash, nullifier, patternHash, emailTimestamp, extraData].
template Provenance(maxHeadersLength, n, k) {
    signal input emailHeader[maxHeadersLength]; // private: the DKIM-signed header bytes
    signal input emailHeaderLength;             // private
    signal input pubkey[k];                     // private: RSA modulus limbs
    signal input signature[k];                  // private: RSA signature limbs

    // Public inputs (bound into the proof).
    signal input domainHash;
    signal input patternHash;
    signal input emailTimestamp;
    signal input extraData;

    // Public outputs (computed, cryptographically real).
    signal output pubkeyHash;
    signal output nullifier;

    // Verify the DKIM RSA signature over SHA-256(header). Body hash check ignored
    // (header-only DKIM authenticity); no masking; no soft-line-break removal.
    component ev = EmailVerifier(maxHeadersLength, 0, n, k, 1, 0, 0, 0);
    ev.emailHeader <== emailHeader;
    ev.emailHeaderLength <== emailHeaderLength;
    ev.pubkey <== pubkey;
    ev.signature <== signature;
    pubkeyHash <== ev.pubkeyHash;

    // Per-email nullifier over the signature — unique, and reveals nothing about content.
    component nl = PoseidonLarge(n, k);
    nl.in <== signature;
    nullifier <== nl.out;

    // Bind the pass-through public inputs so the optimizer can't drop them and so the
    // proof is specific to (domainHash, patternHash, emailTimestamp, extraData).
    signal d2; d2 <== domainHash * domainHash;
    signal p2; p2 <== patternHash * patternHash;
    signal t2; t2 <== emailTimestamp * emailTimestamp;
    signal e2; e2 <== extraData * extraData;
}

component main {public [domainHash, patternHash, emailTimestamp, extraData]} =
    Provenance(640, 121, 17);

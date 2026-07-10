# zkEmail proof design

How p2peace turns raw `.eml` files into on-chain facts. Companion to
[ARCHITECTURE.md](./ARCHITECTURE.md) §3 and the blueprint specs in `circuits/`.

## 0. Three verification tiers

p2peace has three ways to turn an email into an on-chain fact. They differ only in
*what the cryptography guarantees* — every one of them enforces the identical
contract-level rules (DKIM key must be registered and not revoked, nullifier
uniqueness, freshness windows, sender/wallet bindings). Be precise about which tier a
given claim rests on:

1. **DEMO — mock verifier.** `MockGroth16Verifier` accepts *any* proof. Every
   contract-level rule is enforced, but the cryptography is not: anyone can register
   because no real signature is ever checked. This tier exists solely to walk the full
   flow end-to-end without producing a real proof. It proves nothing about a real email.

2. **REAL ON-CHAIN DKIM — `RealEmailVerifier.sol` + `RSAPKCS1.sol` (new).**
   Genuinely verifies an email's RSASSA-PKCS1-v1.5 signature on-chain via the modexp
   precompile (`0x05`), checks the SHA-256 digest, requires the signed `From` header to
   carry the allowlisted government sender, and derives the recipient nullifier from the
   signed bytes. This is **real cryptographic verification of a real email** — but it is
   **not zero-knowledge**: the signed headers, including the recipient address, are
   public calldata. It exists so the mechanism can be exercised with a real inbox today.
   Detail in §8 below.

3. **ZK — production endpoint.** Compiled zkEmail circuits prove the *same statement*
   (a genuine DKIM-signed government email exists) while keeping the email private. This
   is the upgrade. `RealEmailVerifier` is the honest, non-private stepping stone to it.

The through-line: tier 2 proves **authenticity**; tier 3 proves **authenticity +
privacy**. Tier 1 proves neither and is for demos only.

## 1. Background: what zkEmail proves

Every serious mail sender signs outgoing mail with **DKIM** (RFC 6376): the sending
server signs `hash(canonicalized headers ∥ body-hash)` with an RSA key whose public half
is published in DNS at `<selector>._domainkey.<domain>`. A zkEmail circuit takes the raw
email as private input and proves, in zero knowledge:

1. the DKIM RSA signature verifies against a public key with Poseidon hash `H_pk`
   (public signal — the chain checks `H_pk` against a **DKIMRegistry**, not DNS);
2. the signed header contains `from: <domain>` (public: `domainHash`);
3. selected regexes match over the signed body/headers, exposing only chosen captures
   or a boolean (public: `patternHash` identifying which compiled regex ran);
4. arbitrary derived values — here: a **nullifier** and the **Date** header timestamp.

The prover runs client-side (WASM or local binary via the zk-email SDK). Nothing but the
public signals ever leaves the user's machine.

## 2. Public-signal ABI (both proof types)

Contracts consume proofs via a single struct (`contracts/src/interfaces/IZKEmailVerifier.sol`):

```solidity
struct EmailProof {
    bytes32 dkimPubkeyHash;  // Poseidon(RSA pubkey limbs)
    bytes32 domainHash;      // keccak256(lowercase sender domain)
    bytes32 nullifier;       // see per-type derivation below
    bytes32 patternHash;     // keccak256(blueprint id ∥ version) — pins the exact circuit
    uint64  emailTimestamp;  // Date header, unix seconds (0 if the blueprint omits it)
    uint256[8] proof;        // Groth16 (πA[2], πB[4], πC[2])
}
```

`ZKEmailVerifier.verify(EmailProof)`:
1. `DKIMRegistry.isKeyValid(domainHash, dkimPubkeyHash)` — key must be registered and
   not revoked;
2. Groth16 verification of `proof` against the verifying key registered for
   `patternHash`, with public inputs `(dkimPubkeyHash, domainHash, nullifier,
   patternHash, emailTimestamp)`.

The Groth16 backend is pluggable per `patternHash` (each compiled blueprint has its own
verifying key). This repo ships the interface plus a `MockGroth16Verifier` used in
tests; `circuits/` documents producing real verifiers with `zk-email` tooling (compiled
snarkjs verifier contracts drop in without touching the rest of the system).

## 3. Proof type A — citizenship

**Blueprint** `p2peace/citizenship-v1` (`circuits/blueprints/citizenship.json`):

| Field | Value |
|---|---|
| Sender domain | the allowlisted government domain (one blueprint instance per domain) |
| Header regexes | `from:` domain match; `to:` capture of recipient address (private) |
| Body regexes | template anchor of the government notice (e.g. tax-receipt subject line) — proves the mail is a real institutional notice, not a support-desk auto-reply |
| Timestamp | `date:` header, exposed |
| Nullifier | `Poseidon(recipientAddress, REGISTRATION_SALT)` — recipient address stays private; constant per address |

Registration binds `nullifier → wallet`. Renewals and wallet rotation re-use the same
nullifier with a fresh proof (freshness window `maxProofAge`, default 90 days),
proving *continued* control of the same government-known inbox.

**Why not prove the ID document itself?** Documents require either OCR-in-circuit
(research-grade) or a trusted attestor (privacy hole). Institutional-email possession is
the pragmatic middle: costly to fake at scale (requires real interactions with a
government portal per identity), zero marginal infrastructure, fully private.

## 4. Proof type B — news event

**Blueprint** `p2peace/news-event-v1` parameterized per incentive
(`circuits/blueprints/news-event.json`):

| Field | Value |
|---|---|
| Sender domain | any domain; exposed as `domainHash`, matched on-chain against the incentive's source set |
| Body regex | the incentive's compiled keyword logic (see below) |
| Timestamp | `date:` header, exposed — used for the 7-day event window |
| Nullifier | `Poseidon(dkimSignature)` — unique per physical email |

**Keyword logic compilation.** The original proposal's boolean keyword builder
(`(checkpoint removal OR military withdrawal) AND (Jordan Valley OR West Bank) AND …`)
compiles to a zk-regex: OR-groups become alternations, AND-groups become a set of
regexes that must all match (zk-regex proves each; the circuit ANDs the match flags).
The compiled artifact is hashed → `patternHash`, stored in the proposal, and voted on.
Voters approve an *exact circuit*, not prose; attesters must use that circuit or the
proof is rejected.

**Attestation counting.** `EventAttestation` counts *distinct sender domains* per
category (A / B / International) inside the window; the per-email nullifier stops
double-counting one email, and per-domain dedup stops one outlet's daily digest from
filling multiple slots.

## 5. DKIM key lifecycle

DKIM keys rotate (typically 6–12 months); DNS only serves the *current* key. Historical
proofs need archived keys, and compromised keys need revocation:

- `DKIMRegistry` stores `domainHash → keyHash → {validFrom, revokedAt}`.
- Key additions come from governance (timelocked) — in production, fed by
  archive oracles (e.g. community DKIM archives / ZK Email's registry) that watch DNS
  and archive keys with validity windows.
- Revocation is immediate (guardian) — a leaked mail-server key is an
  event-forgery weapon; see THREAT-MODEL.md.
- Proof acceptance requires the email timestamp to fall inside the key's validity
  window when known.

## 6. Proving pipeline (user-facing)

```
inbox → download .eml
      → app/verify (browser): zk-email SDK loads blueprint by patternHash
      → witness gen + Groth16 prove (WASM, ~10–60s desktop)
      → submit EmailProof to IdentityRegistry.register / EventAttestation.attest
```

No relayer is required (the proof reveals nothing sensitive), but any relayer can
submit on a user's behalf for gasless UX — proofs are self-contained and
non-malleable (`nullifier` binds them; registration additionally binds the target
wallet as a public input so a relayer cannot redirect it).

## 7. Known limitations

- **Newsletter coverage**: keyword patterns must target headline/lead language.
  Practical guidance in `circuits/README.md` (pattern-testing against a personal
  newsletter archive replicates the original's "keyword testing tool").
- **Forwarded mail**: forwarding breaks DKIM alignment for the original sender —
  attesters must use directly received mail. ARC chains are out of scope for v1.
- **Plus-addressing / alias sybils**: `alice+1@…` — the citizenship blueprint
  canonicalizes the captured recipient (strips `+tag`, lowercases) before the
  nullifier hash.
- **Gov domain compromise**: bounded by the domain allowlist + revocation + membership
  expiry; a compromised sender can forge *new* members only until revoked, and
  members it forged expire.

## 8. On-chain verification without ZK (RealEmailVerifier)

`RealEmailVerifier.sol` (backed by the `RSAPKCS1.sol` library) is tier 2 from §0: it
verifies a **real** email fully on-chain, with no proof and no privacy. It is what lets
the mechanism be exercised against a live inbox before the ZK circuits are compiled.

**RSASSA-PKCS1-v1.5 over the modexp precompile.** DKIM signs
`hash(canonicalized headers)` with the sender's RSA private key. Verification is the
RSA public operation: given signature `s`, exponent `e`, modulus `n`, compute
`em = s^e mod n` and check that `em` is the PKCS#1 v1.5 encoding of `SHA256(message)`.
`RSAPKCS1._modexp` performs `s^e mod n` by `staticcall`ing the EVM modexp precompile at
address `0x05`, left-padded to the modulus length (256 bytes for RSA-2048). No
in-circuit big-int math is needed — the precompile is the whole cryptographic core.

**EMSA-PKCS1 encoding checked.** `RSAPKCS1.verify` decodes `em` byte-for-byte against
the RFC 8017 §9.2 encoding for SHA-256:

```
00 01 FF FF ... FF 00 || DigestInfo || H
└┬┘ └┬┘ └────┬─────┘ └┬┘   └──┬───┘   └┬┘
 │   │       │        │       │        └ 32-byte SHA-256(message)
 │   │       │        │       └ DER DigestInfo prefix (19 bytes):
 │   │       │        │         3031300d060960864801650304020105000420
 │   │       │        └ single 0x00 separator
 │   │       └ padding string PS: run of 0xFF, ≥ 8 bytes
 │   └ block type 0x01
 └ leading 0x00
```

The contract checks the leading `00 01`, walks the `0xFF` run up to the `0x00`
separator, matches the 19-byte `SHA256_PREFIX` DigestInfo, and finally compares the
trailing 32 bytes against `sha256(message)`. Any mismatch (wrong padding length, forged
digest, tampered headers) fails. This is the same acceptance predicate a mail server’s
verifier uses.

**From-sender binding.** `verifyIdentityEmail` extracts the value of the DKIM-signed
`from:` header out of the *signed* bytes and requires it to carry the allowlisted
government sender address (`expectedFrom`). Because `From` is inside the signed header
set, it cannot be altered without invalidating the signature. Mailers render `From`
either bare (`from:noreply@btl.gov.il`) or angle-bracketed behind a display name
(`from:=?UTF-8?..?= <noreply@btl.gov.il>`); the check accepts either an exact match or
the `<address>` form contained in the value, so a spoofed display name cannot smuggle a
different sender.

**Recipient → nullifier derivation.** The `to:` header value — likewise read from the
signed bytes — becomes the identity nullifier:
`nullifier = keccak256("p2peace-real-id" ‖ recipientBytes)`. It is constant per
recipient (supporting wallet rotation/renewal) and, because it is taken from signed
bytes, cannot be forged without the domain's private key. `IdentityRegistry.registerReal`
consumes this nullifier exactly as it consumes the ZK path's Poseidon nullifier.

**Privacy tradeoff (explicit).** Everything above happens over **public calldata**:
the signed headers, and therefore the recipient's email address, are visible on-chain.
This tier proves the email is **authentic**; it does **not** hide it. That is the one
and only thing the ZK path adds — the compiled zkEmail circuit proves the identical
statement (authentic DKIM-signed government email → nullifier) while revealing nothing
but the public signals of §2. Use `RealEmailVerifier` to prove the plumbing works with a
real inbox; use the ZK endpoint when privacy is required.

**DKIM key-rotation reality.** The key registered for the live btl.gov.il instance is
*not* btl.gov.il's own direct DKIM key: that key has rotated out of DNS since the email
was sent. What remains resolvable is the Amazon SES key that actually signs
`From: noreply@btl.gov.il` (SES enforces the sender via verified-sender identities), so
that archived/live SES key is what `registerKey` records. This is precisely the
key-archival case the `DKIMRegistry` (§5) is built for: DNS serves only the current key,
but historical or delegated-signer keys must remain verifiable with their validity
windows.

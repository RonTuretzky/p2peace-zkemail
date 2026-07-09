# zkEmail proof design

How p2peace turns raw `.eml` files into on-chain facts. Companion to
[ARCHITECTURE.md](./ARCHITECTURE.md) §3 and the blueprint specs in `circuits/`.

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

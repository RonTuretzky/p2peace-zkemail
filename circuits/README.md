# p2peace zkEmail circuits

This package specifies the two zkEmail proof circuits ("blueprints") that back the whole
protocol, and the pipeline for turning them into real Groth16 verifier contracts that
drop into `ZKEmailVerifier` (which is pluggable per `patternHash`; the Foundry test
suite runs against `MockGroth16Verifier` with the exact same public-signal ABI).

Companion docs: [ZKEMAIL-DESIGN.md](../docs/ZKEMAIL-DESIGN.md) (proof-system rationale),
[ARCHITECTURE.md](../docs/ARCHITECTURE.md) §3 (on-chain consumption).

Contents:

| File | What it is |
|---|---|
| [`blueprints/citizenship.json`](./blueprints/citizenship.json) | `p2peace/citizenship-v1` — registry-style blueprint for the citizenship proof |
| [`blueprints/news-event.json`](./blueprints/news-event.json) | `p2peace/news-event-v1` — blueprint template for news-event proofs (body regex parameterized per incentive) |
| [`keyword-compiler.md`](./keyword-compiler.md) | Spec for compiling proposal keyword logic → zk-regex → `patternHash` |
| [`proving-example.ts`](./proving-example.ts) | End-to-end TypeScript walkthrough: `.eml` → proof → on-chain submission |

---

## 1. The two blueprints

**`p2peace/citizenship-v1`** — proves *"I received a DKIM-valid email from allowlisted
government domain D, addressed to an inbox I control"*. One blueprint **instance** is
registered per allowlisted government domain (the sender domain is baked into the
compiled circuit; a different domain means a different circuit, verifying key, and
`patternHash`). The recipient address is captured **privately** from the `to:` header,
canonicalized (lowercased, `+tag` stripped), and hashed into the nullifier — it never
appears in any public signal. An **external input** carries the target wallet address so
the proof is bound to the wallet being registered (a relayer cannot redirect it).

**`p2peace/news-event-v1`** — proves *"a DKIM-valid email from domain D, sent at time T,
matches keyword pattern P in its body"*. One instance is compiled **per incentive**: the
body regexes are generated from the proposal's boolean keyword logic by the
[keyword compiler](./keyword-compiler.md). The sender domain is *not* baked in — it is
exposed as a public capture and checked on-chain against the incentive's approved source
set (so one circuit serves Reuters, WAFA, Haaretz, … for the same incentive). The
nullifier is a Poseidon hash of the DKIM signature bytes — unique per physical email —
using the stock `EmailNullifier` helper from `@zk-email/circuits`.

## 2. Public-signal layout

Both proof types present the same **logical** public-signal vector, in this order:

```
[0] dkimPubkeyHash   Poseidon hash of the DKIM RSA public key limbs (standard zk-email output)
[1] domainHash       keccak256(lowercase sender domain), see packing note below
[2] nullifier        citizenship: Poseidon(canonicalRecipient, REGISTRATION_SALT)
                     news-event:  Poseidon(dkimSignature)
[3] patternHash      keccak256(blueprintId ‖ version) — pins the exact compiled circuit (§5)
[4] emailTimestamp   unix seconds; DKIM `t=` tag when present, else parsed Date: header
[5] extraData        citizenship: uint256(uint160(walletAddress)) external input
                     news-event:  0
```

This maps 1:1 onto the Solidity struct consumed everywhere on-chain:

```solidity
struct EmailProof {
    bytes32 dkimPubkeyHash;   // signal 0
    bytes32 domainHash;       // signal 1
    bytes32 nullifier;        // signal 2
    bytes32 patternHash;      // signal 3
    uint64  emailTimestamp;   // signal 4
    uint256[8] proof;         // Groth16 πA (2), πB (4), πC (2)
}

// signal 5 travels beside the struct:
function verify(EmailProof calldata proof, uint256 extraData) external view returns (bool);
```

`ZKEmailVerifier.verify(proof, extraData)`:

1. `DKIMRegistry.isKeyValid(domainHash, dkimPubkeyHash)` — the signing key must be
   registered for that domain and not revoked, and `emailTimestamp` must fall inside the
   key's validity window when one is recorded;
2. dispatch on `proof.patternHash` to the registered Groth16 verifier for that circuit
   and check `proof.proof` against public inputs
   `(dkimPubkeyHash, domainHash, nullifier, patternHash, emailTimestamp, extraData)`.

Callers pass `extraData` explicitly: `IdentityRegistry.register(proof, communityId,
wallet)` calls `verify(proof, uint256(uint160(wallet)))`;
`EventAttestation.attest(incentiveId, proof)` calls `verify(proof, 0)`.

### Raw vs. logical signals (the adapter layer)

Be precise about what a compiled circuit actually outputs, because it is **not**
literally the six fields above:

- **`dkimPubkeyHash`, `nullifier`, `emailTimestamp`, `extraData`** are direct field
  elements output by the circuit (all < BN254 modulus, so they fit in one signal each).
- **`domainHash` is computed on-chain, not in-circuit.** keccak256 output is 256 bits
  and does not fit in a BN254 field element, and hashing keccak inside the circuit would
  be wasteful. Instead the circuit exposes the matched sender-domain bytes as packed
  field elements (31 bytes/signal — exactly how zk-email registry verifiers expose
  public regex captures today), and a thin **per-blueprint adapter contract** unpacks
  them, computes `keccak256(domainBytes)`, and that becomes the `domainHash` the
  `DKIMRegistry` lookup uses. The adapter also checks the unpacked bytes are lowercase
  ASCII (the circuit's regex already constrains this; the check is belt-and-braces).
- **`patternHash` is not a circuit output at all.** It is a *routing commitment*: the
  Groth16 verifying key registered under `patternHash` in `ZKEmailVerifier` IS the
  binding. A proof can only verify against the verifying key of the circuit that
  produced it, so checking `proof.patternHash == incentive.patternHash` and then
  verifying against `verifiers[patternHash]` is exactly as strong as making the circuit
  output it. The adapter contract has its `patternHash` fixed as an immutable at
  deployment.

So the deployment unit per blueprint instance is: **(snarkjs-generated Groth16 verifier
contract) + (adapter implementing `IGroth16Verifier` that reorders/unpacks raw signals
into the logical six-field ABI)**, registered in `ZKEmailVerifier` under the instance's
`patternHash`. Swapping the mock for a real verifier touches nothing else in the system.

## 3. Proving pipeline (zk-email SDK)

The proving stack is [ZK Email](https://zk.email)'s public tooling:

- **Registry** — [registry.zk.email](https://registry.zk.email): hosts blueprint
  definitions, runs the circom compilation + Groth16 setup for submitted blueprints, and
  serves the resulting artifacts (`.wasm` witness generator, `.zkey` proving key,
  verifier contract, `vk.json`).
- **SDK** — [`@zk-email/sdk`](https://www.npmjs.com/package/@zk-email/sdk) (npm): loads
  a blueprint by slug, generates proofs either **remotely** (ZK Email's prover, default;
  the raw email leaves the machine — fine for public newsletters, *not* acceptable for
  citizenship emails) or **locally** (WASM in-browser / Node; slower, fully private).
- **Circuits** — [`@zk-email/circuits`](https://www.npmjs.com/package/@zk-email/circuits)
  (circom): the `EmailVerifier` template (DKIM RSA verify, header/body hash linkage,
  quoted-printable soft-line-break removal) plus helpers, including
  `EmailNullifier()` (Poseidon over the DKIM signature — used verbatim for news-event
  nullifiers).
- **zk-regex** — [github.com/zkemail/zk-regex](https://github.com/zkemail/zk-regex):
  compiles "decomposed regex" JSON (see the blueprint files) into circom matchers with
  per-part public/private reveal flags.

User-facing flow (mirrors `docs/ZKEMAIL-DESIGN.md` §6):

```
inbox → download raw message (.eml)
      → app loads blueprint by slug (resolved from the on-chain patternHash, §5)
      → sdk.getBlueprint(...).createProver({ isLocal: true })   // local for citizenship!
      → generateProof(eml, externalInputs)                       // witness + Groth16
      → format publicOutputs + πA/πB/πC into the EmailProof tuple
      → IdentityRegistry.register(...) / EventAttestation.attest(...)
```

See [`proving-example.ts`](./proving-example.ts) for the whole thing in code.

### Honesty box: what is stock tooling vs. project-specific

| Piece | Status |
|---|---|
| DKIM verify, body-hash check, QP soft-break removal, header/body regex with public/private parts, external inputs, pubkey Poseidon hash | **Stock** zk-email (registry blueprints produce all of this today) |
| `EmailNullifier` = Poseidon(DKIM signature) | **Stock helper** in `@zk-email/circuits`; registry blueprints do not emit it by default — our news-event circuit adds one component instantiation |
| Recipient-address capture from `to:` | Stock zk-regex capability |
| Recipient **canonicalization in-circuit** (lowercase A–Z→a–z byte map; `+tag` excluded by capture-group construction) and `Poseidon(recipient, SALT)` nullifier | **Project-specific** circom gadget (small: per-byte select over a ≤64-byte capture) layered on the generated circuit |
| `emailTimestamp` from DKIM `t=` tag (numeric, server-signed; set by Gmail/Google Workspace and most large senders) with Date-header parse fallback | **Project-specific** wiring; the `t=`-tag and Date-header extraction gadgets exist in ZK Email's `ether-email-auth` codebase and are reused, but they are not a registry blueprint checkbox |
| Six-signal logical ABI + adapter contract + `patternHash` routing | **Project-specific** convention (this repo) |

Consequence: the JSON files in `blueprints/` follow registry conventions for everything
the registry natively supports, and carry an `x-p2peace` extension block for the
project-specific parts (nullifier derivation, signal mapping, canonicalization). A
registry-only compilation of these blueprints gets you the DKIM/regex core; the final
circuits wrap that core with the small gadgets above before the trusted setup.

## 4. Compiling a blueprint into a registered on-chain verifier

Per blueprint instance (one per gov domain; one per incentive):

```bash
# 1. Compile the circuit (registry does this on submission; locally:)
circom citizenship_v1.circom --r1cs --wasm -l node_modules \
       -o build/            # main component instantiates EmailVerifier + gadgets

# 2. Groth16 setup against a Powers-of-Tau file large enough for the constraint count
#    (2^23 ptau covers ~8.3M constraints; see §6 for real sizes)
snarkjs groth16 setup build/citizenship_v1.r1cs powersOfTau28_hez_final_23.ptau c0.zkey
snarkjs zkey contribute c0.zkey c1.zkey  # ... ceremony contributions
snarkjs zkey beacon c1.zkey final.zkey <beacon> 10

# 3. Export the Solidity verifier + verification key
snarkjs zkey export solidityverifier final.zkey Groth16Verifier_CitizenshipV1.sol
snarkjs zkey export verificationkey final.zkey vk_citizenship_v1.json
```

Then on-chain (governance/timelock path):

```solidity
// adapter wraps the snarkjs verifier: unpacks domain signals → keccak → domainHash,
// reorders raw signals into the logical 6-signal ABI, pins its patternHash
Groth16Verifier_CitizenshipV1 raw = new Groth16Verifier_CitizenshipV1();
CitizenshipV1Adapter adapter = new CitizenshipV1Adapter(raw, PATTERN_HASH);
zkEmailVerifier.setVerifier(PATTERN_HASH, adapter);   // timelocked, governable
```

Trust note: snarkjs Groth16 requires a per-circuit phase-2 ceremony. For anything beyond
a demo, run a multi-party contribution (the registry's hosted setup is single-party —
acceptable for testing, not for mainnet redistribution triggers). The verifying key
registered under a `patternHash` is immutable once an incentive referencing it is
active; fixing a circuit bug means a new blueprint version → new `patternHash` → new
proposal.

## 5. `patternHash`: pinning the circuit

```
patternHash = keccak256(utf8(blueprintSlug) ‖ "@" ‖ utf8(decimalVersion))

e.g. keccak256("p2peace/citizenship-v1@1")
     keccak256("p2peace/news-event-v1/incentive-42@1")
```

- The slug identifies the blueprint in the registry; the version pins the exact compiled
  artifact (registry blueprint versions are immutable once compiled).
- For news-event instances, the keyword compiler emits the instance slug
  (`p2peace/news-event-v1/incentive-<id>`) deterministically, so proposers, voters, and
  attesters all derive the same `patternHash` from the same compiled artifact.
- **Caveat, stated honestly**: a registry slug@version is a *name*, not a content hash —
  you trust the registry not to swap artifacts under a version. Two mitigations, both
  used: (a) the proposal metadata URI pins `sha256` of the canonical compiled keyword
  JSON and of `vk.json`, so anyone can audit name→content; (b) the thing that is
  actually load-bearing on-chain is the **verifying key** registered under the
  `patternHash` — proofs verify against that key or not at all, regardless of what the
  registry serves later. The registry is UX/distribution, not a trust anchor.

## 6. DKIM key archival & rotation

DNS serves only the *current* DKIM key; senders rotate every ~6–12 months. Since proofs
may be generated from old emails (and citizenship freshness allows 90 days), the
on-chain `DKIMRegistry` must hold key **history**, not a snapshot:

- `DKIMRegistry` maps `domainHash → dkimPubkeyHash → {validFrom, revokedAt}`.
- **Additions** go through governance (timelocked). Operationally they are fed by
  archive watchers: ZK Email maintains a public DKIM archive
  ([archive.zk.email](https://archive.zk.email)) that continuously records
  `selector._domainkey.domain` records with observed validity windows; any watcher can
  submit an addition proposal with the DNS evidence.
- **Revocation** is guardian-immediate (a leaked mail-server key forges events); the
  timestamp-vs-validity-window check in `verify` bounds the damage of late revocation to
  emails "dated" inside the window.
- Rotation therefore never invalidates honest old proofs and never blocks new ones —
  a proof states which key signed (`dkimPubkeyHash`); the chain decides whether that key
  was legitimate for that domain at that email's time.

## 7. Realistic constraint counts & proving times

Ballpark figures for BN254/circom zk-email circuits (dominant costs: RSA-2048
verification ≈ 200–300k constraints; SHA-256 ≈ 25–30k per 64-byte block, so body length
is the main dial; zk-regex ≈ 300–1500 constraints per regex byte-state, small next to
hashing):

| Circuit | Header / body budget | Constraints (approx.) | Browser WASM prove | Native (rapidsnark) |
|---|---|---|---|---|
| `citizenship-v1` (body anchor only, 1k header + 2k body) | 1024 / 2048 | ~1.5–2.5M | 30–90 s, ~2–4 GB RAM | 3–10 s |
| `news-event-v1` (4 keyword groups, 1k header + 4k body) | 1024 / 4096 | ~2.5–4M | 60–180 s, ~4–8 GB RAM | 5–15 s |

- `.zkey` sizes at these counts are ~0.5–1.5 GB — first-time in-browser proving means a
  large download (cache it); the SDK's remote-proving mode exists precisely because of
  this, and is fine for news-event proofs (newsletters are public) but should not be
  used for citizenship emails.
- `shaPrecomputeSelector` (see the news-event blueprint) lets the prover hash the body
  prefix *outside* the circuit up to a selector string, cutting effective body length —
  use it to skip HTML boilerplate before the newsletter's content region.
- On-chain verification is a flat Groth16 pairing check: ~230–280k gas per proof
  regardless of circuit size.

These are estimates from zk-email's published circuits and our budgets, not benchmarks
of compiled artifacts (v1 ships the mock verifier; see IMPROVEMENTS.md §8).

## 8. Pattern-testing before proposing

The original proposal's "keyword testing tool" survives as off-chain UX: run the
compiled decomposed regexes (plain JS regex semantics, same alternations) over your own
newsletter archive (`.mbox`/`.eml` export) to estimate hit/miss rates before committing
a `patternHash` on-chain. Keyword patterns must target **headline/lead-grade language**
— newsletters rarely carry full article text. See `keyword-compiler.md` §6 for the
tester contract between the UI and the circuit.

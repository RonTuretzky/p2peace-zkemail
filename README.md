# p2peace — peer to peer to peace, on zkEmail

**Live demo:** <https://ronturetzky.github.io/p2peace-zkemail/> · **Contracts:** Gnosis
Chain ([addresses](DEPLOYMENT.md)) · branded with the
[Decentral Park UI kit](https://github.com/decentralparknyc/decentralpark-ui-kit) ·
CI/CD by [etherform](https://github.com/BreadchainCoop/etherform)

A full implementation of the **p2p2p** concept ([communetxyz/p2peace @ `v0/ronturetzky-f0bece5e`](https://github.com/communetxyz/p2peace/tree/v0/ronturetzky-f0bece5e)):
a decentralized protocol that builds economic interdependence between citizens of
conflicting nations — re-founded on **zkEmail** (DKIM zero-knowledge proofs) instead of
the zkTLS sketch in the original, with the mechanism design audited and hardened along
the way.

Every flow on the live site executes against the deployed contracts: **verify**
(zkEmail demo-proof registration) → **mint** (faucet + citizen/outsider) →
**incentives** (propose + quadratic dual-majority vote) → **attest** (multi-source
newsletter proofs) → **pools** (dispute-window countdown, finalize, claim) →
**business** (certification polls, cross-community payments). Demo governance windows
are compressed to 10 minutes so the whole loop completes in under an hour. Contract
addresses hydrate at runtime from the [`addresses` branch](../../tree/addresses)
(crowdstake.fun convention) — a redeploy goes live without rebuilding the site.

## What it does

- **Identity** — citizens prove they receive DKIM-signed email from their government
  (tax receipts, ID-portal notices) in zero knowledge. No documents uploaded, no server
  sees anything, the email address never goes on-chain. One inbox ↔ one member.
- **Dual tokens** — verified citizens of each community mint their community's
  reserve-backed token 1:1; outsiders mint at a 2× premium that funds the shared
  Treasury. Every token everywhere stays redeemable 1:1.
- **Peace pools** — 10% of every citizen mint is staked into their community's pool.
  This opt-in stake — never anyone's unstaked savings — is what redistribution moves
  when verified events occur. Pool payouts are an equal per-member peace dividend.
- **Incentives** — anyone proposes: *"if [keyword logic] is reported by ≥1 source from
  each community and ≥2 international sources within 7 days, move X% of the responsible
  side's pool"* (or reward de-escalation from the Treasury). The keyword logic is
  committed as the hash of an exact compiled zk-regex circuit.
- **Governance** — verified members vote quadratically (n votes lock n² tokens),
  and every incentive needs a separate YES-majority in **both** communities plus 30%
  participation. Neither side can impose rules on the other.
- **Events** — any newsletter subscriber on earth can attest: a zkEmail proof that a
  DKIM-signed email from an approved news source matches the incentive's pattern.
  Confirmed events sit in a 48h public-notice window (guardian pause is the
  emergency brake) before value moves.
- **External incentives** — states/NGOs/diaspora escrow funds against specific
  incentives ("tokenized sanctions relief"); tranches release automatically on
  finalized events, or return to the donor at expiry.

## Why zkEmail beats zkTLS here

Under zkTLS, someone must run a notary session against each news site *while the
article is live* — a censorable, bribable choke point. Under zkEmail the evidence is a
DKIM signature the sender's mail server already produced: every subscriber holds
durable, independently provable evidence, proofs can be generated years later from a
saved `.eml`, and there is no notary to trust or attack. Same story for identity:
governments in conflict zones will never expose identity APIs for TLS attestation, but
they already send DKIM-signed email. Full analysis: [docs/IMPROVEMENTS.md](docs/IMPROVEMENTS.md).

## Repository layout

| Path | Contents |
|---|---|
| [`contracts/`](contracts/) | Foundry suite — 14 contracts + mocks, deploy script, tests |
| [`circuits/`](circuits/) | zkEmail blueprint specs, keyword→zk-regex compiler spec, proving walkthrough |
| [`app/`](app/) | Next.js site (adapted from the original concept site) with the zkEmail flows |
| [`docs/`](docs/) | [ARCHITECTURE](docs/ARCHITECTURE.md) · [IMPROVEMENTS](docs/IMPROVEMENTS.md) · [ZKEMAIL-DESIGN](docs/ZKEMAIL-DESIGN.md) · [THREAT-MODEL](docs/THREAT-MODEL.md) |

## Contracts

```
ZKEmailVerifier ── DKIMRegistry            (proof + key archive, pluggable Groth16 per blueprint)
IdentityRegistry                           (nullifier roll, rotation/renewal, member counts)
PeaceToken A/B ── PeaceMinter A/B          (reserve-backed 1:1, outsider premium, par flows)
CommunityPool A/B                          (slashable pledge vs equal-per-member rewards)
IncentiveRegistry                          (proposals, quadratic dual-majority voting)
EventAttestation                           (newsletter proofs, rounds, distinct-source tally)
RedistributionEngine                       (48h public-notice window, guarded execution)
Treasury · SanctionsEscrow
```

### Build & test

```sh
cd contracts
git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
git clone --depth 1 --branch v5.1.0 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts
forge build
forge test
```

### Run the site

```sh
cd app && pnpm install && pnpm dev
```

## Proof system status — three verification tiers

Every tier enforces the identical contract-level rules (DKIM key registered + not
revoked, nullifier uniqueness, freshness windows, sender/wallet bindings). They differ
only in what the cryptography guarantees. Full detail in
[docs/ZKEMAIL-DESIGN.md](docs/ZKEMAIL-DESIGN.md) §0 and §8.

1. **DEMO (mock verifier).** `MockGroth16Verifier` accepts any proof: every
   contract-level rule runs, but the crypto does not, so anyone can register. For
   walking the flow only — it proves nothing about a real email.
2. **REAL ON-CHAIN DKIM (`RealEmailVerifier.sol` + `RSAPKCS1.sol`).** Genuinely
   verifies an email's RSASSA-PKCS1-v1.5 signature on-chain via the modexp precompile
   (`0x05`), checks the SHA-256 digest, requires the signed `From` to carry the
   government sender, and derives the recipient nullifier from the signed bytes. This is
   **real cryptographic verification of a real email — but not zero-knowledge**: the
   signed headers (including the recipient address) are public calldata. It exists so
   the mechanism can be exercised with a real inbox today.
3. **ZK (production endpoint).** Compiled zkEmail circuits prove the *same statement*
   while keeping the email private. This is the upgrade; `RealEmailVerifier` is the
   honest, non-private stepping stone. Blueprint specs and the compilation pipeline live
   in [circuits/](circuits/); registering the generated verifiers is the only step
   between the mock backend and private proofs — no contract changes required.

Tier 2 proves **authenticity**; tier 3 proves **authenticity + privacy**.

**Deployed `RealEmailVerifier` (Gnosis Chain):**
[`0x6Ac204183EBE2AFe11097ae697FF1Af0F5A3dA44`](https://gnosisscan.io/address/0x6Ac204183EBE2AFe11097ae697FF1Af0F5A3dA44).
The full system is being redeployed with the real path wired into
`IdentityRegistry.registerReal`. The registered key is the Amazon SES key that signs
`From: noreply@btl.gov.il` — btl.gov.il's direct DKIM key has since rotated out of DNS,
exactly the key-archival case the `DKIMRegistry` models.

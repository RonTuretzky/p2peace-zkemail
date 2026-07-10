# p2peace — zkEmail Architecture

**p2p2p (peer to peer to peace)** is a decentralized protocol for fostering economic
cooperation between citizens of conflicting nations. This document specifies the full
system as implemented in this repository, re-founded on **zkEmail** (DKIM-signature
zero-knowledge proofs) instead of the zkTLS design sketched in the original concept site.

The original proposal is preserved (and adapted) in `app/`; the analysis of what we
changed and why is in [IMPROVEMENTS.md](./IMPROVEMENTS.md); the proof-system deep dive is
in [ZKEMAIL-DESIGN.md](./ZKEMAIL-DESIGN.md); attacks and mitigations are in
[THREAT-MODEL.md](./THREAT-MODEL.md).

---

## 1. Why zkEmail

The original proposal used zkTLS for two jobs:

1. **Identity verification** — prove citizenship without revealing personal data.
2. **Event verification** — prove that trusted news sources reported an event, to
   trigger token redistribution.

zkEmail does both jobs with strictly better trust properties:

| Property | zkTLS | zkEmail |
|---|---|---|
| Trust anchor | TLS session transcript, attested by a **notary/MPC network at fetch time** | **DKIM signature** already produced by the sender's mail server |
| Who must participate | Prover + notary must be online during the TLS session | Nobody — any recipient can prove **after the fact** from a saved `.eml` |
| Durability | Session transcript must be captured live; unrepeatable | Email + signature persist forever; proofs can be generated years later |
| Extra trust assumption | Notary honesty (or MPC committee) | None beyond DNS/DKIM, which the email ecosystem already relies on |
| On-chain verification | Verify notary attestation signature | Verify a Groth16 proof against the DKIM public key registry |

Concretely for p2peace:

- **Identity**: governments already send DKIM-signed email (tax receipts, national ID
  portal confirmations, health-fund notices). A citizen proves in zero knowledge:
  *"I received an email from `taxes.gov.example` addressed to me"* — revealing only a
  nullifier, never the address or contents.
- **Events**: news organizations send DKIM-signed newsletters and breaking-news alerts.
  Any subscriber proves: *"An email from `newsletters.reuters.com` sent at time T
  matches the keyword pattern committed to by incentive #42"* — the article text itself
  never goes on-chain.

The event pathway is the deepest improvement: under zkTLS, *someone* must run a notary
session against each news site while the article is live. Under zkEmail, **every
newsletter subscriber in the world is a potential attester**, the evidence is archived in
millions of inboxes, and no notary infrastructure exists to be censored, bribed, or
DDoSed.

---

## 2. System overview

```
                          ┌─────────────────────┐
        .eml file  ──────▶│  zkEmail prover      │──── Groth16 proof ────┐
   (gov email or          │  (browser WASM /     │                       │
    news newsletter)      │   zk-email SDK)      │                       ▼
                          └─────────────────────┘        ┌───────────────────────────┐
                                                         │        ZKEmailVerifier     │
                                                         │  Groth16 verify +          │
                                                         │  DKIMRegistry lookup       │
                                                         └───────┬───────────┬───────┘
                                                                 │           │
                                              citizenship proof  │           │  news-event proof
                                                                 ▼           ▼
┌──────────────┐   member roll   ┌──────────────────┐    ┌──────────────────────┐
│ PeaceMinter  │◀───────────────▶│ IdentityRegistry │    │  EventAttestation    │
│ 1:1 citizens │                 │  nullifiers,     │    │  multi-source tally, │
│ 2x outsiders │                 │  community roll  │    │  event windows       │
└──────┬───────┘                 └──────────────────┘    └──────────┬───────────┘
       │ 10% peace stake                 ▲ gates voting             │ confirmed events
       ▼                                 │                          ▼
┌──────────────┐                ┌────────┴─────────┐     ┌──────────────────────┐
│CommunityPool │◀── slash/pay ──│ IncentiveRegistry │────▶│ RedistributionEngine │
│  A and B     │                │ quadratic voting, │     │ 48h notice window,   │
│ equal-share  │                │ dual majority     │     │ pool-to-pool moves   │
│  claims      │                └──────────────────┘     └──────────┬───────────┘
└──────────────┘                                                    │
       ▲                    ┌──────────────────┐
       └────────────────────│  SanctionsEscrow │
         milestone release  │  external donors │
                            └──────────────────┘
```

Two ERC-20 **PeaceTokens** exist (Community A, Community B). A shared **Treasury**
accumulates outsider minting premiums and donations, and funds positive-action rewards.

---

## 3. Proof types

Both proofs are zkEmail circuits (see [ZKEMAIL-DESIGN.md](./ZKEMAIL-DESIGN.md) and
`circuits/`). On-chain they share a uniform public-signal layout, checked by
`ZKEmailVerifier`:

```solidity
struct EmailProof {
    bytes32 dkimPubkeyHash;   // Poseidon hash of the DKIM RSA pubkey that signed the email
    bytes32 domainHash;       // keccak256 of the sender domain string (e.g. "wafa.ps")
    bytes32 nullifier;        // proof-type-specific; prevents replay (see below)
    bytes32 patternHash;      // commitment to the regex/blueprint the body matched
    uint64  emailTimestamp;   // DKIM-covered Date header, unix seconds
    uint256[8] proof;         // Groth16 πA, πB, πC
}
```

### 3.1 Citizenship proof

*Claim*: "I received a DKIM-valid email from government domain D, addressed to an email
account I control, sent within the last `maxProofAge` days."

- **Nullifier** = `Poseidon(recipientEmailAddress, REGISTRATION_SALT)`. Constant per
  email address → one registration per address, without ever revealing the address.
- **patternHash** identifies the citizenship blueprint for domain D (e.g. matches a tax
  receipt template).
- `IdentityRegistry` maps `domainHash → communityId` (a governable allowlist of
  government/institutional domains per community), enforces nullifier uniqueness,
  freshness (`emailTimestamp ≥ now − maxProofAge`), and records
  `wallet → { communityId, verifiedAt, expiresAt }`. Membership expires after
  `membershipDuration` (default 365 days) and can be renewed with a fresh proof.

### 3.2 News-event proof

*Claim*: "A DKIM-valid email from news domain D, sent at time T, contains body text
matching keyword pattern P."

- **Nullifier** = `Poseidon(dkimSignature)` — unique per physical email, so the same
  newsletter can only be attested once, but *different* emails from different sources
  (or different editions) each count.
- **patternHash** must equal the pattern commitment stored in the incentive being
  attested (the boolean keyword logic from the original proposal, compiled to a
  zk-regex; see §5).
- `EventAttestation` checks D is in the incentive's approved source set, T is inside the
  event window, and tallies distinct source domains per category.

---

## 4. Identity & membership

`IdentityRegistry`:

- `register(EmailProof, communityId, wallet)` — verifies proof via `ZKEmailVerifier`,
  checks the domain is allowlisted for `communityId`, consumes the nullifier, enrolls
  the wallet.
- One nullifier ↔ one wallet at a time. Re-registration with the same nullifier can
  **rotate** the wallet (lost-key recovery) after the previous enrollment expires or via
  the same nullifier proof (proving continued control of the email account).
- `memberCount(communityId)` supports equal-per-member pool claims and quorum math.
- Domain allowlist changes go through governance + timelock (a hostile domain insertion
  is an identity-forgery vector; see threat model).

**Sybil model** (stated honestly): one identity per email address at an allowlisted
government domain, *not* one per human. Multiple gov addresses per person are possible
but rare (most government portals bind one contact address per national ID). This
matches or exceeds the original zkTLS design's guarantee, with far less infrastructure.

---

## 5. Incentives (proposals)

`IncentiveRegistry` implements the original four-step lifecycle with concrete
parameters:

1. **Propose** — anyone (no tokens needed, per the original). Rejected proposers enter a
   30-day cooldown. A proposal contains:
   - `direction`: `HarmfulByA | HarmfulByB | PositiveByA | PositiveByB | Joint`
   - `patternHash`: commitment to the compiled keyword logic (the boolean
     keyword combinations from the original UI, compiled off-chain to a zk-regex
     blueprint; the hash pins the exact circuit the attesters must use)
   - `sources[]`: approved sender domains, each tagged `CommunityA | CommunityB |
     International`
   - `required{A,B,Intl}`: distinct-source thresholds (original default: ≥1 A, ≥1 B, ≥2 Intl)
   - `attestationWindow` (default 7 days), `redistributionBps` (capped by
     `maxRedistributionBps`, default 5%), `maxTriggers` and `triggerCooldown`
     (a recurring event cannot drain a pool; see threat model)
2. **Discussion** — 7 days. Proposal is immutable on-chain; amendments = new proposal.
3. **Voting** — 3 days, quadratic + dual-majority (§6).
4. **Activation** — if passed, the incentive becomes active and `EventAttestation`
   accepts proofs for it.

## 6. Governance: quadratic voting with dual majority

The original proposal wanted quadratic voting but based it on token holdings — which is
sybil-vulnerable without identity (split your tokens across wallets and the quadratic
penalty vanishes). **zkEmail identity is what makes quadratic voting actually work**:

- Only **verified members** vote.
- A member casting `n` votes locks `n²` whole tokens of their community's PeaceToken for
  the duration of the vote (returned afterwards, win or lose).
- Tally requirements, all three necessary:
  - majority YES among Community A vote weight,
  - majority YES among Community B vote weight,
  - participation (voters across both communities) ≥ 30% of registered members.

Dual majority means neither side can impose redistribution rules on the other — the
protocol only encodes what both communities separately consent to.

`ParamGovernor` (timelock, default 48h) owns parameter changes: DKIM registry updates,
domain allowlists, redistribution caps, council membership. A **guardian** can pause
attestation/redistribution (not funds) in emergencies; the pause itself auto-expires.

---

## 7. Peace pools & redistribution (the load-bearing redesign)

The original text says "tokens are redistributed from Nation A holders to Nation B
holders". On-chain, confiscating from arbitrary holder balances is both **technically
impossible to do fairly** (you cannot iterate holders; punishing only on-chain-active
wallets is arbitrary) and **ethically wrong** (it seizes savings of individuals for
state actions they may oppose — collective punishment, exactly what the protocol exists
to end).

We replace it with **opt-in staked exposure**:

- Every mint routes `poolBps` (default 10%) of the minted tokens into the minter's
  **CommunityPool**. This is the member's *peace stake* — capital explicitly consented
  to be at risk against their own community's aggression. Buying in = signing the
  rebalancing agreement from the original proposal.
- **Harmful event by community X** → `redistributionBps` of pool X moves to pool Y.
- **Positive unilateral action by X** → reward paid **from the shared Treasury** to pool
  X (funded by outsider premiums + donations), not from the counterpart's pool —
  rewarding de-escalation must not itself punish the other side.
- **Joint actions** → Treasury pays both pools.
- Pool balances are claimable by verified members of that community on an
  **equal-per-member** basis (accumulator pattern: `rewardPerMember` grows on inflow;
  members claim deltas). Equal-per-member (not pro-rata by wealth) is deliberately
  democratic and is only possible because identities are sybil-resistant.

`RedistributionEngine` sequencing per confirmed event:

```
attestation thresholds met (within window)
  → CONFIRMED, 48h public-notice window opens (amount snapshotted)
  → guardian may pause settlement (pause auto-expires; funds never at guardian's reach)
  → FINALIZED: pool transfer / treasury payout executes,
    SanctionsEscrow milestones referencing this incentive release
```

---

## 8. Minting & token economics

Per community, `PeaceMinter` sells PeaceTokens against a reserve asset (demo: MockUSD):

- **Verified citizens**: 1:1. 90% of tokens to the minter, 10% to their CommunityPool.
- **Outsiders**: premium price (default 2×). Tokens minted 1:1 against *half* their
  payment; the premium half goes to the **Treasury** in reserve asset. Same token
  rights (they can't vote — voting needs identity — matching "same economic rights"
  while keeping governance to the two communities; an explicit deviation from the
  original, justified in IMPROVEMENTS.md).
- **Redemption**: burn tokens → reserve asset 1:1, while reserve lasts. Pool-staked
  tokens are not redeemable until claimed as rewards.

## 9. External incentives (tokenized sanctions relief)

`SanctionsEscrow`: any external party (state, NGO, diaspora) deposits reserve assets
against a **milestone** = (incentiveId, beneficiary community | both | treasury,
expiry). When the referenced incentive has a **finalized** event, the tranche releases
to the beneficiary pool(s). After expiry with no trigger, the donor may reclaim. This
is the original's "escrow contracts + verification contracts + execution contracts"
collapsed into one auditable primitive, with zkEmail as the verification layer.

## 10. Repository layout

```
contracts/   Foundry project — all of the above, plus mocks and full test suite
circuits/    zkEmail blueprint specs (citizenship + news-event), zk-regex notes,
             proof-generation walkthrough using the zk-email SDK
app/         Next.js site: original concept site adapted to the zkEmail design,
             with interactive demo pages
docs/        this file, IMPROVEMENTS.md, ZKEMAIL-DESIGN.md, THREAT-MODEL.md
```

## 11. Deployment topology & parameters

One `Deployment` (see `contracts/script/Deploy.s.sol`) wires:

| Parameter | Default | Governable |
|---|---|---|
| `poolBps` (peace stake on mint) | 1000 (10%) | yes (timelock) |
| `outsiderPremiumBps` | 20000 (2×) | yes |
| `maxRedistributionBps` per event | 500 (5% of pool) | yes |
| discussion / voting period | 7d / 3d | yes |
| participation quorum | 3000 (30%) | yes |
| public-notice window | 48h | yes |
| membership duration / proof freshness | 365d / 90d | yes |
| guardian pause max duration | 14d | fixed |

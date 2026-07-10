# What the original proposed, what we changed, and why

The v0 concept site (github.com/communetxyz/p2peace, branch `v0/ronturetzky-f0bece5e`)
describes p2p2p as: dual national tokens, zkTLS citizenship verification, keyword-based
news verification triggering token redistribution, quadratic dual-majority governance,
tokenized sanctions relief, and peace-abiding business certification.

This is a genuinely strong mechanism-design sketch. It also has real gaps — some
technical, some economic, some ethical. This document is the audit of the original idea
and the rationale for every deviation in this implementation.

---

## 1. zkTLS → zkEmail (the assignment, and why it's the right call anyway)

The original leans on zkTLS in two places. Both have problems zkEmail solves.

### Identity

The original flow ("upload government ID → zkTLS verifies against Government API →
biometric matching → municipal database cross-reference") quietly assumes:

- governments of *nations in active conflict* expose identity APIs a zkTLS session can
  attest — they almost never do;
- a biometric pipeline and a "verification system" server that sees your raw documents —
  contradicting the privacy claim outright;
- a notary network no participant has reason to trust.

**zkEmail replacement**: prove receipt of a DKIM-signed email from an allowlisted
government domain (tax receipt, ID-portal confirmation, health-fund notice). No
government cooperation needed — they already send DKIM-signed mail. No server ever sees
documents; proving happens client-side from a saved `.eml`. The nullifier is a hash of
the recipient address, so not even the address goes on-chain.

*Honest trade-off*: this proves "controls an email account that receives mail from a
government domain", not "is a citizen". So does zkTLS in practice (it proves "has
credentials to some portal"). Neither achieves one-per-human; ours is cheaper, private,
and works today. We mitigate residual sybils with equal-per-member claims **capped by
pool inflows** (a sybil earns claim shares, not mint rights) and with governance
quadratic-locking real capital.

### Events

The original's redistribution trigger is its most fragile part: a monitoring system must
run zkTLS sessions against news sites *while articles are live*, through a notary. That
is a single choke point in an adversarial environment — the exact place a state actor
would censor, DDoS, or bribe.

**zkEmail replacement**: news orgs (Reuters, AP, Haaretz, WAFA, Al Jazeera — all of the
original's listed sources) send DKIM-signed newsletters and breaking-news alerts.
*Every subscriber on earth* holds durable, independently-provable evidence. Attestation
is permissionless: any inbox owner can submit a proof. There is no monitoring service
to attack, and evidence survives article edits, retractions, and takedowns — the DKIM
signature is frozen at send time. Article-modification detection, which the original
listed as an open feature, comes for free.

*Honest trade-off*: coverage is limited to what sources put in email (newsletters
usually carry headlines/leads, not full articles — keyword patterns must target
headline-grade language); and DKIM keys rotate, so the DKIM registry must archive keys
(see THREAT-MODEL.md §DKIM).

---

## 2. "Redistribute from holders" → opt-in peace pools

The original: "a portion of the aggressor nation's tokens are redistributed".

Three fatal problems:

1. **Technically unimplementable as stated** — you cannot iterate ERC-20 holders
   on-chain; any approximation (tax on transfers? rebasing?) punishes arbitrary subsets.
2. **Economically self-defeating** — rational holders exit the token the moment tension
   rises, so the deterrent evaporates exactly when needed; worse, it creates a
   short-the-peace attack (buy the other side's token, provoke, profit).
3. **Ethically wrong** — confiscating an individual's savings because *their state*
   acted is collective punishment: the logic the protocol exists to replace.

**Fix — peace pools**: 10% of every mint is staked into the minter's community pool.
This stake — and only this stake — is exposed to redistribution. Minting *is* signing
the original's "rebalancing agreement" (which the original itself said voters must
consent to; we make consent structural instead of assumed). Harmful events slash pool →
pool. The deterrent is real but bounded (per-event cap, per-incentive trigger caps and
cooldowns), and nobody's unstaked savings are touchable.

**Positive actions pay from the shared Treasury, not the counterpart's pool.** The
original had every reward come out of "the general pool"; rewarding one side's
de-escalation by slashing the other side is a feedback loop that manufactures
grievance. The Treasury (outsider premiums + donations + escrow inflows) is the correct
funding source: outsiders subsidize peace, which is precisely the sanctions-relief
thesis of the original's external-incentives page.

**Equal-per-member claims** (not pro-rata by wealth): pools pay out identically per
verified member. This is only possible because zkEmail gives sybil-resistant identity —
and it converts redistribution from "wealth transfer between whales" into a per-citizen
peace dividend, which is much closer to the stated intent.

## 3. Quadratic voting that is actually quadratic

Token-weighted quadratic voting without identity is a null-op: split 100 tokens across
10 wallets and cast 10× votes at linear cost. The original listed quadratic voting and
identity verification but never connected them. We do: **only verified members vote**,
votes cost `n²` locked tokens, weight `n`, one ballot per identity. The dual-majority
requirement (separate YES majorities in each community + 30% joint participation) is
kept exactly as proposed — it's the best idea in the original document.

## 4. Event confirmation is two-phase with an explicit state machine

The original describes "automatic execution" and *also* a 48h dispute window and *also*
council reversal, without ordering them. We pin the state machine:

`ATTESTING (≤7d window) → CONFIRMED (48h dispute freeze) → FINALIZED (irreversible) | REVERSED`

Funds move only at FINALIZED. Council reversal (75% supermajority, per the original)
can only happen in the window, and cannot touch finalized events — courts before
bailiffs, and no retroactive reversals that would make every payout permanently
uncertain.

## 5. Abuse economics the original didn't price

- **Repeat-trigger drain**: one incentive + a recurring news pattern ("clashes reported
  in X") could fire weekly and empty a pool. Added: `maxTriggers`, `triggerCooldown`,
  per-event `redistributionBps` cap.
- **Keyword griefing**: patterns are committed as `patternHash` at proposal time and
  frozen; the dual majority votes on the *exact* compiled pattern, not prose. The
  original's keyword-testing tool remains the off-chain UX for tuning before proposing.
- **Source capture**: distinct-domain thresholds per category (≥1 A-source, ≥1 B-source,
  ≥2 international, exactly the original defaults) mean a single captured newsroom (or
  one compromised DKIM key) cannot fire an event alone.
- **Nullifier replay**: every proof type has an explicit nullifier (per-address for
  identity, per-email for attestations).

## 6. Things kept as proposed

- Dual tokens per community, 1:1 citizen minting, ~2× outsider premium.
- Proposal lifecycle: open proposing, no fee, 30-day rejection cooldown, 7-day
  discussion, 3-day vote.
- Source-category thresholds and the 7-day same-event window.
- 48h waiting window before settlement. *(The 75% dispute council was later removed; the guardian's auto-expiring pause is the remaining brake.)*
- Sanctions-relief escrow with milestone release on verified events + donor expiry
  refund.
- ~~Business certification with cross-community cooperation bonus~~ *(implemented, then removed by owner decision in July 2026).*
- Guardian/emergency pause and timelocked parameter changes ("multi-sig requirements
  for system updates" in the original).

## 7. Explicit deviations (flagged, defensible, reversible by governance)

| Original | Here | Why |
|---|---|---|
| Outsiders get "same voting rights" | Outsiders mint & hold but don't vote | Voting is identity-gated; giving conflict-external capital voting power over redistribution rules between two communities is a capture vector. Their influence flows through the Treasury they fund. |
| Rewards from "general pool" | Rewards from Treasury | See §2. |
| Redistribution hits all holders | Hits opt-in pool stakes only | See §2. |
| Municipal tokens/roles | Deferred (docs only) | Municipality identity = same zkEmail mechanism on municipal domains; kept out of v1 contract scope to keep the core auditable. |
| Non-citizen KYC | Not implemented | KYC is jurisdiction-specific and off-protocol; the premium is enforced on-chain, compliance stays at the on-ramp. |

## 8. Deliberately out of scope for v1

Fiat on/off ramps, real Groth16 verifying keys (circuits are specified in `circuits/`
and the verifier is pluggable; tests use a mock verifier with the exact public-signal
ABI), satellite-imagery/observer oracles, cross-chain deployment, and the
decades-horizon token-merge mechanics from the tokenomics page.

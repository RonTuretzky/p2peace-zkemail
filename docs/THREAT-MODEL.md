# Threat model

Attacks against the p2peace zkEmail design, organized by asset/surface. Companion to
[ARCHITECTURE.md](./ARCHITECTURE.md) (mechanisms and parameters referenced here) and
[ZKEMAIL-DESIGN.md](./ZKEMAIL-DESIGN.md) (proof internals). Each entry names the
*concrete* mitigation in the implementation, not a vague intention — and where the
mitigation is partial, it says so. §8 lists what the design does **not** defend against,
plainly.

Severity scale:

- **Critical** — forges identity or events at scale, or moves funds it shouldn't.
- **High** — meaningfully degrades a core guarantee (sybil resistance, event integrity,
  governance legitimacy) for a determined attacker.
- **Medium** — costly nuisance, bounded loss, or requires multiple simultaneous failures.
- **Low** — annoyance; bounded by design to negligible impact.

Standing assumptions: Groth16 soundness holds (a proof implies the statement); the
circuits in `circuits/` correctly encode the statements in ZKEMAIL-DESIGN.md §3–4;
Ethereum liveness and censorship-resistance hold. Attacks on those assumptions are
out of scope here except where noted in §8.

---

## 1. DKIM layer

The root of trust for *everything*: both proof types reduce to "an RSA key whose hash is
in the `DKIMRegistry` signed this email". A DKIM failure is a failure of both identity
and events simultaneously, which is why this section leads.

### 1.1 Mail-server key compromise — **Critical**

**Attack.** An attacker exfiltrates the private DKIM key of an allowlisted domain (mail
server breach, insider, or state seizure of a government/newsroom mail provider). They
can now mint arbitrary DKIM-valid emails: forged citizenship notices from a gov domain
(→ sybil identities) or forged newsletters from a news domain (→ fabricated event
attestations). This is the single worst failure in the system.

**Mitigation.**
- *Identity blast radius*: a forged gov email creates *new* members only. Existing
  registrations are untouched (their nullifiers are already consumed). Forged members
  are removed by (a) **guardian revocation** of the compromised key in `DKIMRegistry`
  (`revokedAt`, immediate — no timelock, per ZKEMAIL-DESIGN.md §5), and (b) **membership
  expiry** (`membershipDuration`, 365d) with renewal requiring a fresh proof against a
  non-revoked key — forged members cannot renew and lapse out of the roll.
- *Event blast radius*: one compromised news key fills at most **one** slot in the
  distinct-source tally. Firing an event needs the incentive's `required{A,B,Intl}`
  thresholds (default ≥1 A + ≥1 B + ≥2 International = **four independently keyed
  domains**). Even then, the **48h dispute window** and **DisputeCouncil 75% reversal**
  sit between CONFIRMED and any fund movement, and the **guardian** can pause
  attestation/redistribution (auto-expiring, ≤14d) while keys are revoked.
- *Loss bound*: even a fully successful forged event moves at most
  `redistributionBps ≤ maxRedistributionBps` (5%) of one opt-in pool, once per
  `triggerCooldown`.

**Residual.** Between compromise and detection, forged identities can vote and claim
pool shares. Detection is off-chain (the mail operator or the community noticing
implausible attestations); the protocol bounds damage, it does not detect compromise.

### 1.2 Key rotation gaps — **Medium**

**Attack.** Not an attacker, but an availability failure that invites one: DKIM keys
rotate every 6–12 months and DNS serves only the current key. If the `DKIMRegistry`
lags a rotation, honest proofs from new emails fail (users can't register or attest);
if it lags a *revocation-worthy* rotation (a domain rotates *because* it was
compromised), the old key stays accepted.

**Mitigation.** `DKIMRegistry` stores `domainHash → keyHash → {validFrom, revokedAt}`
windows; additions flow from archive oracles (community DKIM archives / ZK Email's
registry) through the **ParamGovernor timelock (48h)**, so the registry tracks DNS with
bounded lag. Proofs are accepted only when `emailTimestamp` falls inside the key's
validity window, so an old key never validates an email dated after its window closed.
The `maxProofAge` freshness window (90d) means identity proofs can't lean on
arbitrarily ancient keys anyway.

**Residual.** A 48h+ registration lag is a liveness gap for attesters during a breaking
event; the 7-day `attestationWindow` absorbs it in practice. A domain that silently
rotates a compromised key still needs an explicit revocation of the old key.

### 1.3 DNS takeover of a gov/news domain — **Critical**

**Attack.** Registrar compromise, expired-domain re-registration, or state seizure of a
domain's DNS. The attacker publishes their *own* DKIM key at
`<selector>._domainkey.<domain>` and sends "authentic" mail. Unlike 1.1, no mail-server
breach is needed — this is the cheap version, and expired newsroom domains in conflict
zones are a realistic target.

**Mitigation.** The chain never reads DNS. `DKIMRegistry` additions go through the
**governance timelock (48h)**, so an attacker-published key is not accepted until it
survives a public, timelocked registration — the takeover is visible (Certificate
Transparency-style community monitoring of allowlisted domains is the expected oracle
behavior) before the key is usable. The **domain allowlist itself** is governed
(dual-majority vote + timelock, ARCHITECTURE.md §4), so a domain that changes hands can
be delisted, and delisting plus membership expiry drains any members it minted.

**Residual.** If the archive oracle blindly forwards DNS observations and governance
rubber-stamps them, the timelock is the only barrier. The oracle policy — *who decides a
newly observed key is legitimate* — is an off-chain trust decision this protocol
inherits rather than solves.

### 1.4 Revocation latency — **High**

**Attack.** Exploit the gap between key compromise and on-chain revocation: generate
and submit proofs faster than the guardian reacts.

**Mitigation.** Revocation is deliberately **not** timelocked — the guardian revokes
immediately (asymmetric by design: adding trust is slow, removing it is fast). The
guardian can simultaneously **pause attestation and redistribution** (scope-limited,
auto-expires ≤14d) to stop in-flight exploitation. For events, the ATTESTING→CONFIRMED
→FINALIZED pipeline means proofs submitted during the gap are still reversible for 48h
after confirmation; the council reverses events whose attestations trace to a
now-revoked key.

**Residual.** Identity registrations completed during the gap stand until expiry unless
governance delists/cleans them; there is no per-registration retroactive revocation in
v1. Revocation also cannot distinguish forged from honest emails signed by the same key
in the compromise window — honest users of that domain are collateral until re-proof.

### 1.5 Archived-key poisoning of the DKIMRegistry — **High**

**Attack.** The registry must hold *historical* keys (ZKEMAIL-DESIGN.md §5 — proofs
from saved `.eml` files need keys DNS no longer serves). An attacker feeds the archive
oracle a fabricated "historical" key for a target domain — one they hold the private
half of — with a validity window in the past, then forges backdated emails.

**Mitigation.**
- Every key addition, historical or current, passes the **governance timelock**;
  historical keys should carry corroboration (multiple independent archives, DNSSEC
  proofs where available) before governance accepts them — this is a stated
  requirement on the oracle, not optional hygiene.
- The `emailTimestamp` must fall inside the poisoned key's claimed window **and**
  inside protocol freshness bounds: identity proofs require
  `emailTimestamp ≥ now − maxProofAge` (90d), so a key whose window closed >90 days ago
  is useless for registration; event proofs require the timestamp inside a currently
  ATTESTING incentive's 7-day window, so deep-past keys are useless for events too.
  **Poisoning only pays if the fake window overlaps the recent past**, which is exactly
  where live DNS observation makes fabrication hardest to slip through.

**Residual.** A poisoned key with a recent validity window that survives governance
review is equivalent to 1.1 for that domain. The freshness bounds shrink the target,
they don't close it.

---

## 2. Identity & sybil resistance

Asset: the member roll — it gates voting, equal-per-member claims, and quorum math.

### 2.1 Multiple government email addresses per person — **Medium**

**Attack.** One human controls several addresses that each receive allowlisted-domain
mail (old + new address on file, multiple portals across allowlisted domains for the
same community), registering each as a distinct member.

**Mitigation.** Stated honestly in ARCHITECTURE.md §4: the guarantee is **one identity
per email address at an allowlisted government domain, not one per human**. The design
bounds what a marginal sybil buys rather than pretending to prevent it:
- Pool claims are **equal-per-member shares of pool inflows** — a sybil earns extra
  claim shares of a bounded pot, not mint rights or treasury access; the expected value
  per sybil falls as the roll grows.
- Voting is quadratic in **locked capital** (`n` votes lock `n²` tokens): sybils reset
  the quadratic exponent but each ballot still costs real, at-risk capital, and each
  sybil needs its own gov-domain interaction history to register.
- Allowlist curation (governance) prefers domains that bind one contact address per
  national ID (tax authorities, ID portals) over loose ones.

**Residual.** A person with N legitimate gov addresses is N members. This is a known,
priced limitation, not a solved problem.

### 2.2 Plus-addressing / alias canonicalization — **Low**

**Attack.** `alice+1@gov.example`, `alice+2@…`, or case variants, each yielding a
distinct nullifier from the same underlying inbox.

**Mitigation.** The citizenship blueprint **canonicalizes the captured recipient in-
circuit** before hashing: strips `+tag`, lowercases (ZKEMAIL-DESIGN.md §7). The
nullifier `Poseidon(canonical(recipientAddress), REGISTRATION_SALT)` is identical
across aliases. Dot-stripping for providers that ignore dots is a blueprint-version
concern; blueprint versions are pinned by `patternHash`, so a canonicalization fix
ships as a new pattern without contract changes.

**Residual.** Genuinely distinct mailboxes that alias to one person server-side
(role accounts, shared family inboxes) are invisible to canonicalization — folds into
2.1.

### 2.3 Stolen `.eml` replay — **High**

**Attack.** Government emails are not secrets: they sit in inboxes, backups, leaked
archives, and forwarded threads. An attacker who obtains someone's `.eml` can generate
a fully valid proof from it — the circuit proves possession of the file, not of the
inbox.

**Mitigation.** Three independent layers:
- **Wallet binding**: the registration circuit exposes the target wallet as the 6th
  public input (`extraData`; 0 for attestation proofs). A proof observed in the mempool
  or leaked from a relayer cannot be redirected to the attacker's wallet — they'd need
  to generate a *new* proof, which requires the raw `.eml`.
- **Freshness window**: `maxProofAge` (90d) — old dumps and stale leaks are useless;
  the attacker needs a *recent* email.
- **Nullifier occupancy + monotonic timestamp on rotation**: if the victim is already
  registered, the nullifier is consumed; a thief can only attempt wallet *rotation*,
  and rotation requires a proof whose `emailTimestamp` is **strictly greater** than the
  timestamp of the proof backing the current enrollment. The legitimate owner, who
  receives ongoing mail, can always out-date a thief holding a fixed stolen file; the
  thief needs sustained inbox access (at which point see §8 — full inbox compromise is
  not defended).

**Residual.** A recent stolen email used *before* the victim ever registers wins the
nullifier. First registration is first-come; the recovery path is the same rotation
mechanism (victim proves with a fresher email), which turns a theft into a race the
inbox owner wins — but during the race the thief holds a vote and claim rights.

### 2.4 Membership expiry and quorum dilution — **Medium**

**Attack.** Two directions. (a) Lapsed members inflate `memberCount`, making the 30%
participation quorum unreachable and freezing governance. (b) An attacker times
proposals for periods of mass expiry (e.g., after an annual tax-season registration
wave ages out) to pass votes against a shrunken active roll.

**Mitigation.** `memberCount(communityId)` counts only **unexpired** enrollments
(`expiresAt` checked), so lapsed members leave both the numerator and denominator of
quorum — direction (a) is structural, not behavioral. For (b), the quorum floor
(`participation ≥ 30%` of the *current* registered roll) plus **dual majority** means a
timed proposal still needs separate YES majorities among whoever remains in *both*
communities; shrinking the roll shrinks the attacker's own vote base symmetrically.
Renewal is a fresh proof with the same nullifier — cheap for anyone still receiving
government mail.

**Residual.** A community with systematically worse renewal friction (e.g., its
government's mail infrastructure degrades mid-conflict — plausible!) sees its roll and
thus its governance weight decay. The dual majority protects it from being outvoted,
but not from deadlock (§4.3).

### 2.5 Wallet rotation abuse — **Medium**

**Attack.** Use rotation to evade consequences or double-dip: rotate to a new wallet to
dodge slashing exposure, re-claim pool accumulator deltas, or escape a vote-lock.

**Mitigation.** Rotation moves the *enrollment*, not balances: pool claim state is
keyed by **nullifier**, not wallet (ARCHITECTURE.md §7 accumulator is per-member =
per-nullifier), so the claim cursor (`rewardPerMember` checkpoint) travels with the
identity — no re-claim. Vote locks are token locks on the old wallet and are not
released by rotation. Slashing hits the CommunityPool corpus, which no individual
wallet holds, so rotation is irrelevant to it. Rotation requires the monotonic-
timestamp fresh proof (2.3), so it's rate-limited by receiving new government mail.

**Residual.** Selling an identity = handing over the inbox (rotation follows inbox
control). Identity markets are possible; the price of one identity is bounded by its
claim stream and one ballot — see §8.

---

## 3. Events & the news oracle

Asset: the ATTESTING → CONFIRMED → FINALIZED pipeline, which moves pool funds and
releases sanctions-escrow tranches.

### 3.1 Source capture — **High**

**Attack.** Control or compromise enough approved source domains to fire an incentive:
bribe a newsroom, buy a dying outlet on the source list, or combine one DKIM compromise
(§1.1) with one cooperative publisher.

**Mitigation.** **Distinct-domain thresholds per category** in each incentive
(`required{A,B,Intl}`, default ≥1 Community-A source + ≥1 Community-B source + ≥2
International): a captured source fills one slot in one category, ever — per-domain
dedup means an outlet's ten newsletters are still one domain. The default demands
*adversarial corroboration*: at least one source aligned with each side must have
reported the event. Source sets are fixed per incentive at proposal time and approved by
**dual-majority vote**, so each community vets the other's proposed sources. After
thresholds are met, the **48h dispute window + 75% council reversal** is the
human backstop against a technically-valid-but-false confirmation.

**Residual.** Four-way capture (an A outlet + a B outlet + two international outlets)
defeats the tally; the council is then the only defense. Incentives configured with
lazy source lists (many low-credibility domains) lower this bar — source-list quality
is a governance duty, not a protocol guarantee.

### 3.2 Phrasing mismatch — false negatives — **Medium**

**Attack.** Not adversarial, or weakly so: a real event occurs but newsletters phrase it
outside the committed pattern ("troops pull back" vs. the committed "military
withdrawal"), so a deserved trigger never fires. An adversary aware of the pattern can
also pressure friendly outlets toward non-matching phrasing.

**Mitigation.** Patterns are compiled from the boolean keyword builder with OR-group
alternations (ZKEMAIL-DESIGN.md §4) — proposers are expected to enumerate synonyms, and
the off-chain **pattern-testing tool** (IMPROVEMENTS.md §5, the original's keyword
tester run against personal newsletter archives) exists precisely to tune recall before
committing. A missed event is recoverable: propose a corrected-pattern incentive (new
`patternHash`, new vote). The failure mode is *no funds move* — safe-by-default.

**Residual.** False negatives are inherent to keyword matching over headline-grade
newsletter text. The design accepts "misses possible, forgeries expensive" as the right
asymmetry for a system that moves money.

### 3.3 Keyword griefing — overly broad patterns — **High**

**Attack.** Propose a pattern that *sounds* targeted but compiles broad ("clashes" AND
"border"), matching routine coverage weekly and slashing a pool for non-events; or
sneak a subtly-broader regex than the prose description suggests.

**Mitigation.** The pattern is committed as **`patternHash` at proposal time, frozen,
and the dual majority votes on the exact compiled circuit, not prose**
(ARCHITECTURE.md §5, IMPROVEMENTS.md §5) — anyone can compile the published blueprint
and diff the hash during the 7-day discussion window; a hash that doesn't match the
described logic is a public, checkable lie. If a broad pattern passes anyway, damage is
bounded by §3.4's rate limits, and each firing still needs the multi-category source
thresholds *and* survives a 48h dispute window where the council reverses
non-events.

**Residual.** Verification-by-recompilation only protects communities that actually do
it. The tooling makes it a one-command check; the vigilance is still human.

### 3.4 Repeat-trigger pool drain — **High**

**Attack.** A legitimately recurring pattern ("shelling reported in X" — sadly weekly)
fires repeatedly and empties the target pool through many individually-capped events.

**Mitigation.** Three stacked parameters per incentive (ARCHITECTURE.md §5, §12):
- `redistributionBps ≤ maxRedistributionBps` (500 = 5% of the pool) per event,
- `maxTriggers` — hard lifetime cap on firings per incentive,
- `triggerCooldown` — minimum spacing between firings.

Worst case is `maxTriggers × 5%` of a pool, spread over `maxTriggers × triggerCooldown`
time — visible, disputable, and slow enough for governance to deactivate a
misbehaving incentive through a counter-proposal. And only the opt-in pool corpus is
reachable at all (§5.1).

### 3.5 Old-email replay across time — **Medium**

**Attack.** Hold a genuine newsletter about a *past* event and submit it later to
trigger a *new* incentive window, or drip-feed old proofs into a fresh window.

**Mitigation.** `EventAttestation` requires both bounds: the DKIM-covered
`emailTimestamp` must fall **inside the specific event's attestation window**, and
submission must occur while that window is open (the ATTESTING state is the submission
lag limit — a proof cannot arrive after the 7-day window closes, so email age and
submission lag are jointly capped at `attestationWindow`). An email predating the
window fails the timestamp check regardless of when it's submitted.

**Residual.** Within one 7-day window, an email about a *different but
similar-sounding* event matches if the pattern can't distinguish them — that's §3.3's
pattern-precision problem, not a replay problem.

### 3.6 Same-email double count — **Low**

**Attack.** Submit one newsletter twice (or via two wallets) to fill two tally slots.

**Mitigation.** Per-email nullifier `Poseidon(dkimSignature)` — the DKIM signature is
unique per physical email, so the second submission is a consumed nullifier, regardless
of submitter. Additionally, tallies count **distinct sender domains**, so even distinct
emails (daily digest editions) from one outlet fill only one slot.

### 3.7 Cross-incentive replay — **Low**

**Attack.** One genuine email that happens to match two incentives' patterns is used to
advance both — or a nullifier consumed on incentive #1 blocks legitimate use on #2.

**Mitigation.** Nullifier consumption in `EventAttestation` is **scoped per incentive**
(`incentiveId → nullifier → used`): the same physical email may attest each matching
incentive at most once, and each use independently requires `patternHash` to equal
*that* incentive's committed pattern and the sender domain to be in *that* incentive's
source set. Two incentives that both genuinely match a real event both deserve the
attestation; the per-incentive caps (§3.4) bound the aggregate.

---

## 4. Governance

Asset: the rule-making power — incentive approval, parameter changes, allowlists.

### 4.1 Wealth capture vs. quadratic voting — **Medium**

**Attack.** A whale converts capital into vote weight.

**Mitigation.** Votes cost `n²` **locked** PeaceTokens for weight `n`, and — the part
the original missed (IMPROVEMENTS.md §3) — **only verified members vote, one ballot per
identity**, so the classic quadratic bypass (split tokens across wallets) requires
sybil identities (§2.1), not just wallets. 10× the capital buys ~3.16× the weight, per
identity. Outsiders hold tokens but **cannot vote at all** (explicit deviation,
IMPROVEMENTS.md §7) — conflict-external capital has no direct rule-making channel.

**Residual.** Wealth still buys super-linear influence *through people* — see 4.2.

### 4.2 Vote-buying with identity — **High**

**Attack.** Quadratic voting's textbook weakness: since one identity's marginal vote is
cheap, buying many *cheap* votes from many *real* members beats concentrating capital.
A state actor paying citizens for ballots is the realistic version.

**Mitigation.** Partial, and stated as such. Structural friction: ballots cost the
*voter's own* locked tokens (the buyer must fund wallets traceably or trust
reimbursement); on-chain votes are public per wallet, but the wallet↔person link is
protected (see §6.3), so a buyer cannot verify compliance without the seller
volunteering deanonymization — no receipt, weaker enforcement of the bribe. **Dual
majority** means a buying campaign must succeed in *both* communities independently;
buying only your own side's majority achieves nothing.

**Residual.** No on-chain system prevents coordinated off-chain vote markets. The dual
majority raises the price to "corrupt both sides at once"; it does not make it
infinite. This is a known open problem, inherited, not introduced.

### 4.3 Dual-majority deadlock — **Medium**

**Attack.** Less an attack than a built-in cost: either community (or a blocking
minority within it, or a lapsed-roll quorum failure per §2.4) can freeze *all* new
incentives indefinitely. An adversary who prefers the status quo simply organizes NO
votes on their own side.

**Mitigation.** Deliberate. Non-consent to new redistribution rules is a **feature**
(ARCHITECTURE.md §6: "the protocol only encodes what both communities separately
consent to") — the failure mode is *nothing happens*, never *rules imposed on one
side*. Already-active incentives keep operating through deadlock, so gridlock cannot be
used to switch off previously agreed deterrents; deactivation needs its own dual-
majority vote.

**Residual.** A protocol both sides stop agreeing to extend gradually ossifies. That is
the honest shape of consent-based mechanism design; there is no override, and adding
one would be worse.

### 4.4 Participation-quorum manipulation — **Medium**

**Attack.** (a) Register throwaway identities that never vote, inflating the roll to
push participation below 30% and veto-by-apathy. (b) Withhold your community's turnout
to kill proposals without casting NO.

**Mitigation.** (a) requires sybil registrations, gated by §2.1's cost (real gov-domain
interactions per identity), and inflating a roll also inflates *claim* dilution for the
attacker's own community's honest members — communities have incentive to police their
allowlist quality. Expiry (§2.4) continuously drains dormant registrations. (b) is
functionally a NO vote and is legitimate under dual consent; the 30% floor (governable,
timelocked) exists to prevent the *opposite* attack — a tiny activist quorum passing
rules while nobody watches.

### 4.5 Proposal spam — **Low**

**Attack.** Flood the pipeline with junk proposals (proposing is free, by original
design) to exhaust voter attention or bury a hostile proposal amid noise.

**Mitigation.** **30-day cooldown per rejected proposer** (ARCHITECTURE.md §5) rate-
limits serial spam per wallet; each proposal still runs a 7-day discussion + 3-day vote
and dies at the participation floor by default — spam produces no state changes, only
noise. Sybil-wallet spam is possible (proposing needs no identity) but each junk
proposal is inert without dual-majority turnout.

**Residual.** Attention exhaustion is real; curation/UX (front-ends surfacing proposals
with locked-token discussion engagement) is the off-chain answer. The chain guarantees
spam can't *pass*, not that it can't *annoy*.

### 4.6 Timelock bypass — **High**

**Attack.** Push a hostile parameter change (e.g., allowlist a fake gov domain §1.3,
raise `maxRedistributionBps`, swap the DKIM oracle) fast enough that nobody reacts.

**Mitigation.** Every `ParamGovernor` path — DKIM registry additions, domain
allowlists, redistribution caps, council membership — sits behind the **48h timelock**
(ARCHITECTURE.md §6); there is no un-timelocked admin path to parameters. The two
deliberate exceptions are **narrowing-only**: guardian key *revocation* (§1.4) and the
guardian *pause*, both of which can only reduce what the system accepts, never expand
it. Council reversal threshold (75%) and guardian pause cap (14d) are **fixed, not
governable** (§12) — the safety rails can't be voted away.

**Residual.** 48h assumes someone watches. Timelock monitoring (bots alerting both
communities on queued operations) is required operational practice, not optional.

### 4.7 Guardian abuse — **Medium**

**Attack.** A malicious or coerced guardian pauses the system to block a legitimate
imminent event confirmation ("pause as veto"), or revokes valid DKIM keys to disenroll
a community's proof pipeline.

**Mitigation.** Guardian scope is **attestation and redistribution only — never funds**
(ARCHITECTURE.md §6): it cannot move Treasury, pools, or escrow, cannot change
parameters, cannot add keys or domains (only revoke/pause — narrowing-only, §4.6). The
pause **auto-expires** (max 14d, fixed) — a veto-by-pause delays, it cannot kill;
attestation windows and dispute clocks resume. Guardian membership itself is changed
through the timelocked governor, so a rogue guardian is replaceable within 48h.

**Residual.** A guardian revoking valid keys causes up to 14 days of denial-of-service
per incident plus re-registration friction. Repeated abuse is visible on-chain and
answerable by replacement; a guardian colluding with a key-compromise attacker to *not*
revoke is covered by anyone else escalating to governance (slower, 48h).

---

## 5. Economics

Asset: pool corpora, redemption reserves, the Treasury, sanctions escrow.

### 5.1 Short-the-peace — **Medium**

**Attack.** The original design's fatal flaw (IMPROVEMENTS.md §2): hold exposure that
*profits from conflict* — e.g., position to gain when community X's holders are
slashed, then provoke or fabricate a harmful-by-X event.

**Mitigation.** Structurally bounded by the pool redesign: **only opt-in pool corpus is
at risk** — `poolBps` (10%) of mints, explicitly consented, capped at
`maxRedistributionBps` (5%) per event with trigger caps/cooldowns (§3.4). Unstaked
balances are untouchable, so there is no way to attack *holders*; the profit ceiling of
a fabricated event is a share of ≤5% of the counterpart pool, paid **equal-per-member**
— an attacker receives one member-share, not the transfer. Capturing a meaningful slice
of the payout requires mass sybils (§2.1) *and* a forged event (§1/§3) *and* surviving
the dispute window. The attack cost exceeds the bounded prize by construction.

### 5.2 Bank-run on redemption reserves — **Medium**

**Attack.** Redemption is 1:1 "while reserve lasts" (ARCHITECTURE.md §8). A panic — or
an engineered scare — races holders to the reserve; late redeemers hold unbacked
tokens.

**Mitigation.** The reserve math is honest by construction: citizens mint 1:1 with
100% of payment retained as reserve (10% of *tokens* to the pool, but the reserve asset
stays), and outsider mints are backed 1:1 on the token-issuing half — the system never
issues more redeemable tokens than reserve **except** via Treasury/pool payouts, which
are the deliberate, bounded unbacked issuance. Pool-staked tokens are **not redeemable
until claimed** (§8), which removes 10% of supply from any run's front. First-come
redemption is disclosed, not hidden.

**Residual.** A sustained one-directional event stream (many finalized harmful events
against one side) makes that community's token partially reserve-short. That is the
deterrent working as designed, and its cost is stated here rather than papered over.

### 5.3 Treasury drain via positive-event farming — **High**

**Attack.** Positive unilateral actions pay **from the Treasury** (§7) — so fabricate
or recycle cheap "de-escalation" news (a routine announcement matching a generous
positive-incentive pattern) to milk it.

**Mitigation.** Positive incentives clear the identical gauntlet as harmful ones: dual-
majority approval of the exact `patternHash` and source set, multi-category distinct-
source thresholds, `maxTriggers`/`triggerCooldown`/bps caps, dispute window + council.
Critically, **dual majority means the community that funds nothing still votes**: a
positive-by-A incentive needs B's majority too, and B has no reason to approve a
farmable pattern that drains the shared Treasury both depend on. Treasury outflow rate
is bounded by the sum of active incentives' caps — auditable in advance.

**Residual.** A Treasury with generous approved incentives and thin inflows (few
outsider mints, few donations) can be run down *legitimately but wastefully* by
marginal events. Treasury runway vs. active-incentive ceiling is a governance
dashboard number someone must watch.

### 5.4 Cooperation-bonus farming — **High**

**Attack.** Wash-trading the `cooperationBonusBps` (2%): a "business" and a payer
collude on circular payments — pay 100, get 2 from the Treasury, return the 100,
repeat. Cross-community collusion pairs are easy to form.

**Mitigation.** Layered. (1) Both endpoints are gate-kept: the payer must be a
verified member and the business must be **certified by member vote of the community
rolls** (simple majority of each community, ARCHITECTURE.md §10), paying out only when
payer and business communities differ; certification is **revocable the same way**.
(2) Because the token round-trip itself is costless (the attacker keeps the tokens),
gate-keeping alone was shown insufficient in adversarial review — so bonus outflow is
**budgeted on-chain**: `BusinessRegistry` pays at most `epochBudgetBps` (default 1%)
of the Treasury snapshot per `bonusEpoch` (default 30 days) across *all* businesses
(`_consumeBonusBudget`). Worst-case wash-trading loss is ~1% of the Treasury per
month — an order of magnitude slower than the 3-day revocation poll that is the
actual remedy, and every `Paid` event is the audit trail.

**Residual.** No on-chain test distinguishes real commerce from circular flow; a
washing business can still skim the epoch budget until revoked, and the shared budget
means a washer starves honest businesses' bonuses for the rest of the epoch (a
nuisance, not a loss). The response remains human: watch `Paid` volumes, revoke.

### 5.5 Sanctions-escrow griefing — **Medium**

**Attack.** From either side: (a) a donor deposits a headline-grabbing tranche against
a milestone designed never to trigger (unmatchable pattern, impossible thresholds),
harvesting goodwill then reclaiming at expiry; (b) an attacker fires a forged event
(§1/§3) to force early release of a tranche the donor intended for a real milestone.

**Mitigation.** (a) Milestones reference **incentiveId** — the referenced incentive
already passed dual-majority vote, so both communities vetted the trigger's
achievability before any donor could point money at it; a donor cannot invent a private
unreachable condition. Expiry + reclaim is disclosed mechanics; reputational
gaming is off-protocol. (b) Release requires the event to be **FINALIZED** — full
attestation thresholds, 48h dispute, council backstop — the same bar as pool
redistribution; escrow adds no weaker path. Tranche funds sit in escrow and can go only
to the pre-committed beneficiary pool(s) or back to the donor: griefing can misdirect
*timing*, never *destination*.

---

## 6. Council & social layer

### 6.1 Council collusion at 75% — **High**

**Attack.** ≥75% of the DisputeCouncil colludes (or is coerced) to reverse legitimate
confirmed events — a standing veto over the entire attestation pipeline; or refuses to
reverse fraudulent ones it favors.

**Mitigation.** Council power is **reversal-only and window-bounded**: it acts only
during the 48h dispute window on CONFIRMED events, cannot originate transfers, cannot
touch FINALIZED events (no retroactive reversals — IMPROVEMENTS.md §4), and cannot
block a *future* re-attestation of the same underlying reality under the same or a new
incentive: systematically reversing real events forces the council to publicly reverse
proof-backed confirmations over and over, on-chain, attributably. Council membership is
governed through the **timelocked ParamGovernor** with dual-majority legitimacy, so a
captured council is replaceable by the communities. Refusal-to-reverse (favoring a
fraudulent event) is backstopped by the guardian pause (14d) buying time for key
revocation to invalidate the fraud's basis before finalization.

**Residual.** The council is the designated trusted human component. 75% (fixed,
non-governable) makes capture expensive, and scope-bounding makes capture *worth less*
— it cannot be made worthless. Council composition (cross-community balance,
term limits) is a constitutional matter above this protocol layer.

### 6.2 Community-roll capture via domain allowlist — **High**

**Attack.** The allowlist maps `domainHash → communityId` — whoever controls it mints
members. Governance-lists a diaspora org, university, or "civil registry" domain the
attacker controls; or a state adds a purpose-built portal domain to stuff its own roll
before a contentious vote.

**Mitigation.** Allowlist changes require **dual-majority vote + 48h timelock**
(ARCHITECTURE.md §4, §6) — community B must approve additions to community A's list,
and vice versa; the adversarial-review incentive is built in, because roll-stuffing on
one side dilutes nothing of its own and shifts vote/claim power the other side will
veto. A rushed addition is impossible (timelock); a regretted one is removable the same
way, after which its members **expire** without renewal ability (365d worst-case decay,
faster if the guardian also revokes the domain's DKIM keys from the registry).

**Residual.** Both communities approving a bad domain together (mutual roll-stuffing
pact) is unmitigable by design — the protocol encodes bilateral consent; it cannot
protect the communities from what they jointly choose.

### 6.3 State coercion of members — **Critical** (severity of harm, not of protocol failure)

**Attack.** A government identifies its own citizens participating in an economic-
peace protocol with the adversary and retaliates. The relevant question is: **what can
an on-chain observer or subpoena learn?**

**What is NOT on-chain / not linkable:**
- Email addresses — never revealed; the identity nullifier is
  `Poseidon(canonicalAddress, REGISTRATION_SALT)`, preimage-resistant, and the salt-
  domain-separated hash prevents dictionary confirmation of a *guessed* address without
  the circuit's salt context being brute-forceable over the address space (large, but
  see residual).
- Email contents — never leave the prover's machine (ZKEMAIL-DESIGN.md §1); only
  pattern-match booleans are proven.
- Which government email/notice was used — only `domainHash` (the domain is public
  anyway, it's the allowlist) and the timestamp.
- Attester identity for news events — the attestation nullifier is
  `Poseidon(dkimSignature)`, a function of the *email*, not the person; any of
  thousands of subscribers could have submitted it, and relayer submission
  (ZKEMAIL-DESIGN.md §6) severs even the gas-payer link.

**What IS on-chain and linkable:**
- `wallet → communityId, verifiedAt, expiresAt` — the *fact* of membership per wallet,
  and community affiliation, is public.
- Voting: which wallet voted, direction, and locked amounts.
- Claims: which wallet claimed pool rewards, when, how much.

So the exposure is: **if a wallet is tied to a person (exchange KYC, on-ramp records,
network analysis), their membership, votes, and claims are fully legible.** The
protocol protects the email identity behind the wallet; it does **not** provide
transactional privacy for the wallet itself.

**Mitigation (partial, honest):** fresh wallets funded through privacy-preserving
rails, relayer submission for proofs, and wallet rotation (§2.5) are available hygiene.
A state that compels its *own* mail provider's logs learns who received which
government notices — but that tells it nothing about protocol participation (everyone
gets tax receipts); the linkage it needs is wallet-side, off-protocol.

**Residual.** The address-space brute-force on identity nullifiers deserves flagging:
government email address formats are often predictable (`firstname.lastname@…`). If
`REGISTRATION_SALT` is a public circuit constant, a state can hash its full citizen
address list and test membership of *nullifiers* — this would deanonymize registrants.
**The salt must be per-user-secret or the design must move to a
`Poseidon(address, userSecret)` nullifier**; v1 circuits must treat this as a
requirement, not an optimization. Documented here so it cannot be quietly skipped.

---

## 7. Cross-cutting: proof & contract layer

Briefer entries for completeness:

- **Mempool front-running of registration** (*Low*) — the wallet is bound in `extraData`
  as a public input; a snooped proof cannot be re-targeted (§2.3). Attestations carry no
  beneficiary at all (`extraData = 0`); front-running one merely submits it for you.
- **Malleability / proof re-encoding** (*Low*) — nullifier consumption is the anti-replay
  mechanism, not proof-bytes uniqueness; Groth16 malleability doesn't matter because the
  public signals (including nullifier) are what's consumed.
- **Wrong-circuit substitution** (*Medium*) — every verifying key is registered per
  `patternHash`, and consumers check `patternHash` equality against the expected
  blueprint (incentive's committed pattern; domain's citizenship blueprint). A proof
  from circuit X cannot satisfy a check pinned to circuit Y. Verifying-key registration
  itself is timelocked governance — a hostile VK swap is a §4.6 event.
- **Mock-verifier deployment risk** (*High, operational*) — v1 tests use
  `MockGroth16Verifier` (IMPROVEMENTS.md §8). Deploying to a value-bearing network with
  any mock or unaudited verifier wired in is the most likely *actual* catastrophic bug
  path in early deployment. Deployment scripts must assert real verifier addresses.

---

## 8. Residual risk — what this design does NOT defend against

Stated plainly, in the spirit of IMPROVEMENTS.md:

1. **One-per-human identity.** We prove control of an email account at an allowlisted
   government domain. A person with several such accounts is several members (§2.1); an
   identity is sellable by selling inbox access (§2.5). Every mitigation *prices*
   sybils; none prevents them.
2. **Full inbox compromise.** An attacker with *ongoing* access to a victim's
   government-known inbox is, to this protocol, the victim. Monotonic-timestamp
   rotation defeats a stolen *file*, not a stolen *account*.
3. **Simultaneous multi-domain DKIM compromise.** A state-level actor holding valid
   DKIM keys for an A-source, a B-source, and two international sources at once can
   fabricate an event that only the council can stop. The design makes this require
   four independent compromises plus surviving a 48h public dispute — it does not make
   it impossible.
4. **Coordinated off-chain vote markets.** Dual majority forces vote-buying across both
   communities; identity-gating removes the receipt. Neither eliminates paid voting
   (§4.2). This is unsolved in the field, not just here.
5. **Bilateral bad decisions.** Anything both communities' dual majorities approve —
   a rotten source list, a farmable pattern, a fake allowlisted domain both sides
   accept — executes. The protocol encodes bilateral consent; it has no opinion about
   its wisdom.
6. **Wallet-level surveillance.** Membership, votes, and claims are public per wallet
   (§6.3). A state that links a wallet to a person learns everything that wallet did.
   The protocol's privacy boundary is the email identity, not the wallet.
7. **The council as trusted humans.** 75% council collusion inside a dispute window
   defeats event integrity for that event (§6.1). Scope- and time-bounded, but real.
8. **Epistemic ground truth.** The protocol verifies *that trusted sources reported X in
   matching words*, not *that X happened*. Coordinated media falsehood — all four source
   categories sincerely reporting the same wrong thing — confirms a non-event. No oracle
   design escapes this; ours at least demands adversarially-aligned sources agree.
9. **Underlying cryptography and platform.** RSA/DKIM breakage, Groth16 trusted-setup
   compromise, circuit implementation bugs, Solidity bugs, and chain-level censorship
   or reorgs. Mitigated by audits, standard tooling, and the pluggable verifier —
   never eliminated.
10. **The peace itself.** A protocol can price aggression and reward cooperation at the
    margin of the capital its participants opt in. It cannot compel states, and its
    deterrent is exactly as large as its pools. Anyone claiming more is selling
    something.

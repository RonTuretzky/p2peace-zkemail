# Research: an ILS-stablecoin representation and a "shekel-devaluation" mechanism

Two questions, researched honestly. Short version up front:

1. **A shekel stablecoin now exists** — you were right. The regulated one, **BILS**, is
   on Solana, not EVM, and is 1:1 redeemable. A synthetic-FX family (**Jarvis jFIAT**)
   exists on EVM but has **no jILS** and is largely dormant.
2. **A literal "sell the shekel to devalue it" mechanism is not real** — not for lack of
   a token, but because full-backed stablecoins are immune to sell pressure and the real
   ILS FX market is far too deep for any protocol to move. The mechanism that *is* real,
   meaningful, and buildable is **demand destruction / seigniorage denial** — measured,
   not manipulated. That's what this repo implements as the **Exit Index**, and it's the
   original concept's "decentralization of economic power" made concrete.

---

## 1. The ILS-stablecoin landscape (as of July 2026)

### BILS — the regulated one (Solana)

- Issued by **Bits of Gold** (Tel Aviv). Full approval from Israel's Capital Market,
  Insurance and Savings Authority on **28 Apr 2026**, after a two-year sandbox pilot.
- **1:1 backed** by shekels in segregated Israeli bank accounts, **EY**-audited,
  custody by **Fireblocks**, privacy via **QEDIT** zero-knowledge proofs.
- Built on **Solana** (token extensions). Intended for FX vs USDC, real-time payments,
  smart-contract execution, cross-border ₪ transfers. Expansion to other chains is
  "planned," not live.
- Sources: [CoinDesk](https://www.coindesk.com/policy/2026/04/28/a-digital-shekel-is-here-israel-approves-its-first-regulated-stablecoin),
  [crypto.news](https://crypto.news/israel-approves-bils-shekel-stablecoin-after-solana-pilot/),
  [Finance Magnates](https://www.financemagnates.com/cryptocurrency/israel-approves-first-shekel-pegged-stablecoin-framework-after-two-year-regulatory-pilot/).

**Implication for us:** BILS is the real thing, but it is **Solana-only and not reachable
from our Gnosis (EVM) contracts today.** No canonical EVM bridge for BILS exists yet.

### Jarvis jFIAT — synthetic FX on EVM (Polygon/Ethereum)

- **Synthereum** mints over-collateralized (USDC-backed) synthetic fiat "jFIATs" with
  zero-slippage swaps against USDC at the Chainlink FX price: jEUR, jCHF, jGBP, jSEK,
  jCAD, jSGD, jPHP, jNZD, … ([defiprime](https://defiprime.com/jarvis-network),
  [jEUR on PolygonScan](https://polygonscan.com/token/0x4e3decbb3645551b8a19f0ea1678079fcb33fb4c)).
- **No jILS** in the set, and Jarvis is largely wound down / low-liquidity by 2025. Even
  if a jILS existed, a Chainlink **ILS/USD feed** would be required — and Chainlink's
  forex feeds cover only majors (EUR/GBP/JPY/CHF/AUD/…), **not ILS**. No standard ILS
  price feed is published on Gnosis.

### The Bank of Israel "digital shekel" CBDC

- Separate track, 2026 roadmap, **no issuance decision yet** — a central-bank liability,
  not something a third-party protocol can hold or move ([Bank of Israel](https://www.boi.org.il/en/economic-roles/payment-systems/future-payment-methods/digital-shekel-cbdc/)).

**Bottom line for #1:** an on-chain ILS token exists (BILS), but there is **no
EVM-native, liquid, oracle-priced ILS instrument** our Gnosis contracts can hold or
trade today. That single fact constrains everything in #2.

---

## 2. Can you build a "shekel-devaluation mechanism"? What that even means.

"Devalue the shekel" can mean two completely different things. They need completely
different machinery, and only one of them is real.

### 2a. Financial devaluation (move the ₪ exchange rate down) — **not feasible, and would be snake oil to claim.**

The DeFi playbook for pushing an asset's price down is: (a) borrow it and sell it,
(b) open a perpetual short, or (c) mint a synth and sell it
([Chainlink synthetics](https://chain.link/article/synthetic-assets-crypto),
[short positions in DeFi](https://chainscorelabs.com/glossary/defi-synthetic-assets-and-derivatives/derivative-contract-structures/short-position)).
Every one of them fails here, for structural reasons — not for lack of a token:

- **You cannot de-peg a fully-backed stablecoin by selling it.** BILS is redeemable 1:1
  for shekels held at a bank. If you dump BILS and its market price dips below 1 ₪,
  arbitrageurs buy it and redeem at par for a risk-free profit until the peg is restored.
  Full backing is *designed* to be immune to sell pressure. Shorting BILS costs you the
  spread and moves the **shekel's** value by exactly nothing.
- **You cannot move the real ILS FX rate.** The shekel spot/forward market turns over on
  the order of tens of billions of dollars a day. No community treasury — or any crypto
  protocol — has the capital to move a G20-adjacent currency's exchange rate. A contract
  that claimed to "devalue the shekel" by trading would be theater.
- **Even a synthetic short needs a deep two-sided market and an ILS oracle**, neither of
  which exists on EVM. A thin jILS pool (if one existed) would just get arbitraged; you'd
  move the *synthetic's* basis, not the sovereign rate.

**Honest verdict:** a protocol that "sells shekels to weaken them" is not achievable and
not meaningful. Anyone who ships one is selling a story, not a mechanism. This repo will
not pretend otherwise.

### 2b. Demand destruction / seigniorage denial (shrink demand to *hold and use* the shekel) — **real, meaningful, and already what the design does.**

A currency's value ultimately rests on **demand to hold and transact in it**, and a
government's monetary power rests on the seigniorage and control that demand provides.
You don't weaken that by selling; you weaken it by **giving people a better place to keep
their economic life.**

Every unit of value that migrates from shekels into community-money-backed-by-sDAI is:

- **demand for the shekel that no longer exists** (a smaller monetary base to command),
- **a balance the central bank can no longer inflate or tax** (seigniorage denied),
- **monetary sovereignty transferred** from the state to the two communities.

This is slow, real, cumulative, and — crucially — **measurable on-chain without holding
or selling a single shekel.** It is precisely the original concept's *"decentralization
of economic power … from centralized governments to local communities"* and *"engineered
lose/lose"* thesis, stated as a mechanism instead of a vibe.

It is also the deepest reason the reserve is **sDAI, not an ILS token**: denominating the
peace economy *outside* the shekel is the exit. Backing it in shekels would re-import the
exact currency the design is trying to route around.

---

## 3. What this repo implements: the Exit Index

The measurable "shekel dump," done honestly:

**Exit Index = the total value denominated outside national currency inside p2peace** —
i.e., the sDAI backing every unit of community money (both minter reserves) + the shared
Treasury + escrowed relief. It is read straight from on-chain balances; no new trust, no
new token, no manipulation. Displayed as:

- **sDAI withdrawn from national-currency demand** (the raw, always-true figure), and
- optionally **≈ ₪X**, using a clearly-labeled off-chain ILS rate (there is no on-chain
  ILS feed to trust, so the ₪ figure is presentational, and says so).

Every join grows it; every redemption shrinks it. It is the running score of *"how much
economic life has left the shekel for money two communities govern together"* — the
honest version of the mechanism you asked for. It ships as a UI panel (`/exit`, linked
from the Year-5 chapter) computed from existing reads — no contract change, nothing to
redeploy, nothing to break.

---

## 4. Future-ready: the BILS conversion module (designed, not deployed)

The *one* place a genuine — if tiny and symbolic — shekel→stable conversion could live is
the escrow, **once BILS reaches EVM**:

> A donor escrows **BILS** (shekel-denominated) against a specific harmful-event
> incentive. On a finalized event, the module **converts that BILS to sDAI** through a
> BILS/USDC pool and routes it to the harmed community's pool. Effect: a bounded,
> consented, event-triggered movement of value *out of shekel-denominated form into
> stable* — the closest thing to a real "dump on trigger," and still not a market
> manipulation, just a conversion of funds a donor already committed.

Why it is **not live**: BILS is Solana-only today, and no EVM BILS/USDC liquidity exists.
The module is specified against the existing `SanctionsEscrow` interface so it drops in
if/when BILS bridges — a `BilsEscrowModule` that adds a `convertOnFinalize` step. Until
then it stays a spec, labeled as such. Building it now against nonexistent liquidity would
be the same theater §2a warns about.

---

## 5. Proof of exit — how a member proves they actually left the shekel

"Measurable" only means something if the exit is *provable*. Two research passes
(multi-lens design + adversarial red-team, and a focused red-team of the
address-binding idea) settled what is and isn't provable. The short version:

**You can prove a conversion happened; you cannot prove a net exit — and the honest
system measures a stock, not a flow.**

### 5.1 A conversion is a DKIM-signed fact

An ILS→stablecoin conversion is an email your exchange signs. Verified live in DNS:
Bits of Gold (`p=reject`, SendGrid RSA-2048), Bit2C (`p=quarantine adkim=s`), Kraken
(`p=reject`), Coinbase (`p=reject adkim=s`) all DKIM-sign transactional mail via
SES/SendGrid — the *exact* delegated-signer / archived-key pattern already handled for
`noreply@btl.gov.il`. So "prove I converted ₪X" reuses the deployed on-chain RSA path
(`RSAPKCS1.sol`) verbatim. The exchange — not the bank — is the party that actually
witnesses shekels becoming a non-shekel asset, so its confirmation email is the most
exit-relevant artifact that exists.

### 5.2 The wall: gross, not net

A signed conversion email survives three attacks that **no** proof can close, because
they are economic, not cryptographic:

- **Round-trip.** The `.eml` is valid forever; convert, save it, re-buy shekels an hour
  later. A one-shot proof can't express "and the shekels are still out."
- **Borrowed-ILS.** Draw an overdraft (standard on every Israeli current account),
  convert the *borrowed* shekels — a flawless receipt, zero net exit. Israeli open
  banking doesn't expose the liability side, so no proof sees this.
- **Provenance of the input.** The email can't tell long-held savings from money
  deposited that morning to mint a receipt, or from pre-held USD.

Net exit is a claim about a person's *entire* balance sheet over time — an open-world,
negative, cross-venue statement. No signed artifact has that shape.

### 5.3 What we build: measure the stock, attach the email as provenance

- **Load-bearing = the on-chain stock** (`ExitAssurance.exitIndex()`): sDAI held in the
  contract right now. Trustless (Gnosis consensus only), it shrinks the instant anyone
  redeems — so it resists round-tripping *by construction* — and it can't be replayed.
  Keyed by the citizenship nullifier, so one person's many wallets aggregate into one
  position instead of inflating the count (Sybil cap; the position follows wallet
  rotation). Its honest limit: it can't show the sDAI was *ever* shekels.
- **Provenance = an optional DKIM conversion receipt** (`ExitReceiptVerifier`), reported
  as its own number, never mixed into the stock. It verifies the RSA signature, then the
  **body** against the signed `bh=` (SHA-256 + base64), so the amount and destination
  address are genuinely under the signature — not free text. One receipt counts once.

### 5.4 The address-binding idea: it closes *who*, not *what*

The instinct "put the destination address in the signed email and require that address
to deposit" is sound in its correct form. Verified against ZKP2P (the production zkEmail
on/off-ramp): binding the depositor to the address named in the signed body makes the
receipt **not a bearer instrument** — it can only ever be claimed by that address, which
kills proof-theft / front-running and stops an *unrelated* wallet satisfying the on-chain
leg. `ExitReceiptVerifier` enforces exactly this (`AddressMismatch` if the claimer isn't
the named address).

But the red-team was clear about the limits: address-binding closes **who deposits**, not
**what** — round-trip, borrowed-ILS, and pre-owned-stablecoin top-ups all survive it.

**Update — a real Bit2C receipt breaks the "no ramp emits a full address" wall.** A genuine
Bit2C (Israeli exchange) withdrawal-confirmation email, verified end-to-end against the
deployed `ExitReceiptVerifier` on a Gnosis fork, carries the **full, un-truncated destination
address in the DKIM-signed HTML body** — its own confirmation language even reads *"to myself
and an address I own."* Two format details the verifier now handles: `c=relaxed/relaxed` body
canonicalization (validated to reproduce Bit2C's signed `bh=` byte-for-byte), and the address
being split by a quoted-printable soft break (`...Cf24=\r\n21676946C`), reassembled on-chain.
Fixing this also surfaced a real header-selection bug (oversigned/absent `h=` entries must
append *nothing*, not an empty header line — the single-instance btl.gov.il path never
exercised it). So the DKIM signature, the body hash, and the address binding of a real
exchange withdrawal genuinely verify on-chain today.

Two caveats remain, and they point at the ZK path:

- **Bit2C settles on Ethereum, not Gnosis** — a bridge hop still severs `address ==
  depositor` for the on-chain arrival leg, so the address binding proves the *withdrawal
  destination*, not that the same coins landed in the contract.
- **The public path is gas-heavy**: a real 37 KB HTML receipt costs ~55 M gas to verify
  on-chain (fine as a read, over the block limit as a transaction).

ZKP2P avoids all of this not with a cleverer email but with **pre-commitment**: the on-chain
leg is the anchor and funds route to a pre-committed address. That's why our load-bearing
measure is the on-chain stock, and the email is only ever provenance riding alongside —
exactly the "measure the sink, don't fake the source" stance of §2b.

### 5.4a Privacy — proving without revealing the address (the ZK path)

The public path proves authenticity but is *not private*: on-chain DKIM verification needs
the signed body (which contains the address, and whose headers contain the recipient email) in
transaction calldata, and calldata is public forever. Hiding the address is therefore not a
tweak — it requires moving the verification *inside a zero-knowledge proof*.

`ExitAssurance.attestProvenanceZK` is that path. A compiled zkEmail circuit proves the same
statement — *"I hold a Bit2C-DKIM-signed withdrawal receipt naming my own address"* — and
reveals **only a nullifier** plus the ramp domain and blueprint hash. The address, amount, and
email never touch the chain. The proof is bound to `msg.sender` (the `extraData` public input),
so a stolen proof can't be redirected (not a bearer instrument); the nullifier is derived
in-circuit as `Poseidon(dkimSignature, walletSecret)` so it dedups replay **and** cannot be
recomputed by the exchange (which knows the signature but not the wallet secret) — closing the
sender-de-anonymization hole. It is also far cheaper: the 37 KB body is processed off-chain and
only a ~250 k-gas proof is verified on-chain. Today it runs on the mock verifier (demo tier,
like identity/events); a compiled circuit drops into the same `exitPattern` slot with no
contract change.

### 5.4b Sovereignty — the shielded exit (Sepolia, no bridge)

Even with the private ZK receipt (§5.4a), a linkage survives that ZK-over-email cannot
touch: Bit2C settles the withdrawal to an on-chain address `W_kyc` that is **KYC-bound to
a regulated Israeli exchange and plausibly gov-visible**. Any transaction from `W_kyc`
(or a wallet it funds) that touches a p2p2p contract puts the citizen on the
peace-protocol graph — dangerous for them. `attestProvenanceZK` hides the *email*, not the
*wallet that transacts*. Participating in a peace protocol with the other side deserves
full sovereignty, so this must be severed.

Targeting **Sepolia (stand-in for Ethereum mainnet, where Bit2C actually settles)** drops
the Gnosis bridge assumption — the withdrawal address and the acting address share one
chain — which makes a clean solution possible: a **`ProvenanceShieldedPool`** whose
anonymity set *is* the set of DKIM-verified real Bit2C exits (Vitalik's Privacy-Pools
association-set idea, inverted so the gate proves *real provenance* instead of blocking
illicit funds).

| Step | Actor | Public | Private |
|---|---|---|---|
| Provenance voucher | anyone | that *some* verified Bit2C exit of bucket D happened | which email / address / amount |
| Deposit (fixed denomination) | `W_kyc` (or a fresh wallet) | a deposit into a *generic verified-exit pool*, bucket, time | secret + spend nullifier → **which** future withdrawal |
| Anonymous withdrawal | relayer, for a fresh address | a withdrawal of bucket D; a pool nullifier; relayer fee | **which deposit it drains** — the link is severed |
| Exit-Index credit | pool → `ExitAssurance.commitFromPool` | the aggregate stock grew | whose |

Three things this fixed or delivered, all real today:
- **A confirmed re-linkage bug:** `commit()`/`pledge()` require `isActiveMember(msg.sender)`,
  so any wallet touching the sink is KYC-adjacent. New `commitFromPool(nullifier, amount)`
  credits the Exit Index keyed by an **anonymous pool nullifier**, no membership — the
  anonymous exit never puts a wallet or identity on a p2p2p-branded contract.
- **Real structure:** incremental Merkle tree + roots history, nullifier double-spend
  prevention, single-use provenance vouchers, fixed denomination, and a relayer fee bound
  via `extDataHash` so **the relayer is untrusted** (can't re-target or inflate the fee).
- **The binding flip:** the voucher proof binds to `extraData=0` (its own exit-nullifier),
  **not** `msg.sender` — so neither the minting nor the depositing wallet is exposed by the
  proof, and the deposit can come from a wallet other than `W_kyc`.

**Deployed + proven end-to-end on Sepolia** (`DeployShieldedExit.s.sol`), with the **real
withdraw verifier**: `ShieldedPool` `0x020Ed3C582F1C6ee50Dd64faAcE0C7b68EA2843B`,
`ExitAssurance` `0x324973865bcD4223898A4bD30B741D8c3047F697`, `WithdrawGroth16Verifier`
`0x81baC255214E81265Bc91AF8b41de7F4136Ec5e3`, `PoseidonHasher`
`0x391788440C62b1245645388196873984977A684F`, reserve MockUSD
`0xe03d3FA16f0b8ef364034B30734583ac1EaF0a40`. A live run (mint voucher → deposit from
`W_kyc` → relayer withdrawal with a **real Groth16 proof**) credited the Exit Index **keyed
by the pool nullifier**, with `exited[W_kyc] == 0` — nothing tied to the KYC wallet. The
Foundry suite includes the key assertion: **no emitted event links `W_kyc` to the exit
credit**, plus real-proof tests that a tampered proof is rejected.

### 5.4c The withdraw circuit is now REAL

The design flagged the **withdraw membership proof** as the load-bearing line between
*"demonstrates the model"* and *"provides anonymity."* That circuit is now compiled and
verified on-chain — the mock is gone from the withdrawal path.

- **Circuit** (`zk/withdraw.circom`): proves knowledge of `(nullifier, secret)` such that
  `commitment = Poseidon(nullifier, secret)` is a leaf in the depth-20 Merkle tree with
  the public `root`, reveals `nullifierHash = Poseidon(nullifier)`, and binds
  `extDataHash` (relayer + fee) — ~11k constraints, Groth16 over BN254.
- **On-chain**: a snarkjs-generated verifier (`WithdrawGroth16Verifier`) behind a thin
  `WithdrawVerifierAdapter` that fits the pool's `IGroth16Verifier` slot. The Merkle tree
  now hashes with **Poseidon** (deployed from circomlib's EVM bytecode) so the on-chain
  root equals the circuit's root byte-for-byte.
- **Proven end-to-end, live on Sepolia**: a genuine proof (`zk/gen-proof.mjs`) was
  deposited and withdrawn on-chain — `getLastRoot() == circuit root`, the real proof
  verified, and `exitIndex` was credited by the anonymous nullifier. A tampered proof or
  a changed relayer/fee is rejected. Foundry: `ShieldedExitReal.t.sol` (4 tests).

> **What's still demo-tier, stated plainly.** Two things remain, and they're independent
> of the withdraw circuit:
> 1. **The trusted setup is single-party** (a local ceremony in `zk/`). The circuit and
>    verifier are real; a *production* deployment needs a multi-party ceremony so no one
>    holds the toxic waste.
> 2. **The provenance gate is still a mock** — proving *"this deposit is a real Bit2C
>    exit"* in zero knowledge needs the zkEmail circuit (RSA-2048 + SHA-256 + regex over
>    the email), a much larger lift than the membership circuit. Until it compiles, the
>    association-set-quality claim ("these are all real exits") is *asserted*, not proven.
>
> And regardless of circuits, real-world safety still needs: a **minimum anonymity-set
> size** (contract-enforced `minDeposits` + a real, continuous population — a cold-start
> pool of five is not anonymous at any *k*), **fixed denominations**, a **randomized
> deposit→withdraw delay**, and a **permissionless relayer market / 4337 paymaster over
> Tor/Waku**. And unhideably, the state can always see that `W_kyc` made a public deposit
> into a *generic* exit pool at time T — which is why the pool is deliberately **not**
> p2p2p-branded and all p2p2p naming lives on the hidden withdrawal side.

### 5.5 The assurance campaigns

Individual capital flight is macro-irrelevant; coordination is the missing piece.
`ExitAssurance` campaigns are a Kickstarter-style threshold — *"together we move ₪N out"* —
that makes the collective move legible when it crosses the goal. Funds are never trapped:
a pledge is a commit that is also tallied to a public goal and can be withdrawn any time;
`reached` is a sticky milestone, not an escrow gate. This is the one genuinely new,
trust-minimized capability the chain is uniquely good at.

### 5.6 What is deployed (Gnosis Chain)

Added **additively** against the live `IdentityRegistry` + sDAI (no system redeploy):

| Contract | Address |
|---|---|
| `ExitAssurance` | `0xCd77F7658f77faf52020dF0a6a8660c01cC452e9` |
| `ExitReceiptVerifier` | `0xa17Bf591bCFD9B4aC9Ce219de73622489119B71f` |

Live at [`/exit`](https://ronturetzky.github.io/p2peace-zkemail/exit): commit/redeem,
assurance campaigns, and a two-tier receipt-upload provenance tab (private ZK path that hides
the address, or public on-chain verification). **Bit2C is wired as an allowlisted ramp** — its
real `s1` DKIM key is registered in `ExitReceiptVerifier`, and `bit2c.co.il` + the exit-receipt
blueprint are allowlisted for the ZK path — so a genuine Bit2C withdrawal email is recognized
on both paths. The public path verifies the real signature/body/address on-chain; the ZK path
is mock-verified until the circuit compiles (the anonymity model is final).

**Honest ceiling.** No scheme here proves a permanent, net exit from the shekel.
Cryptography certifies *authenticity* (the ramp really said this, bound to your address);
it is silent on *economic meaning* (that value irreversibly and net-newly left shekel
form). We measure the one thing provable with zero trust — the live on-chain stock — and
we label everything else exactly as what it is.

## 6. Summary

| Claim | Real? | Why |
|---|---|---|
| An ILS stablecoin exists | **Yes** | BILS (regulated, Solana); Jarvis jFIAT (EVM, no jILS) |
| Our Gnosis contracts can hold/trade ILS today | **No** | BILS is Solana-only; no EVM jILS; no on-chain ILS feed |
| "Sell shekels to devalue the currency" | **No** | Backed stablecoins are un-sellable-down; real FX market too deep |
| Shrink shekel demand / deny seigniorage | **Yes** | Every exit moves economic life out of ₪ — the Exit Index measures it |
| Prove a conversion happened (authenticity) | **Yes** | Real Bit2C DKIM receipt verifies on-chain — body-bound + full-address-bound (`ExitReceiptVerifier`) |
| Prove it *privately* (no address revealed) | **Yes (ZK)** | `attestProvenanceZK` reveals only a nullifier; mock now, circuit-ready |
| Unlink the KYC wallet from p2p2p (sovereignty) | **Yes — real withdraw ZK on Sepolia** | `ProvenanceShieldedPool` + compiled `withdraw.circom` Groth16 proof verified on-chain; single-party ceremony + provenance circuit remain the demo-tier bits |
| Prove a *net* exit from the shekel | **No** | Round-trip / borrowed-ILS / provenance-of-input are unclosable from any artifact |
| Coordinate exits to a collective threshold | **Yes** | `ExitAssurance` assurance campaigns, funds never trapped |
| Event-triggered BILS→sDAI conversion | **Later** | Designed against the escrow; waits for BILS-on-EVM liquidity |

The shekel mechanism is a **demand** mechanism, not a **price** mechanism, and it is a
**stock** measure, not a **flow** proof. We build and measure the real one, and we refuse
to fake the fake one.

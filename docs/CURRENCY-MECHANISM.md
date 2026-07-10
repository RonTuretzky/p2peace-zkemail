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

## 5. Summary

| Claim | Real? | Why |
|---|---|---|
| An ILS stablecoin exists | **Yes** | BILS (regulated, Solana); Jarvis jFIAT (EVM, no jILS) |
| Our Gnosis contracts can hold/trade ILS today | **No** | BILS is Solana-only; no EVM jILS; no on-chain ILS feed |
| "Sell shekels to devalue the currency" | **No** | Backed stablecoins are un-sellable-down; real FX market too deep |
| Shrink shekel demand / deny seigniorage | **Yes** | Every join moves economic life out of ₪ — the Exit Index measures it |
| Event-triggered BILS→sDAI conversion | **Later** | Designed against the escrow; waits for BILS-on-EVM liquidity |

The shekel mechanism is a **demand** mechanism, not a **price** mechanism. We build and
measure the real one, and we refuse to fake the fake one.

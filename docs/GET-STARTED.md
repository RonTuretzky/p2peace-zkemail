# Get started — walk the whole thing in ~40 minutes

**Live app:** <https://ronturetzky.github.io/p2peace-zkemail/>

This is a hands-on guide to every flow, in order. Each step is designed to be as
few clicks as possible — most are a single button that quietly does the approval and
the action together.

> **Before real amounts:** this instance verifies identity/events with a *demo*
> verifier (anyone can submit a demo proof) except for the real-email path, which is
> genuine cryptography but **public** (your email address lands in calldata). Use a
> throwaway wallet and tiny amounts. Full caveats: [DEPLOYMENT.md](../DEPLOYMENT.md).

## What you need

- A wallet (MetaMask, Rainbow, any WalletConnect wallet) set to **Gnosis Chain**.
- A little **xDAI** for gas (≈0.1 is plenty). Everything else — sDAI to join with,
  and the identity/event proofs — you get from inside the app.
- To walk the *full* loop (which ends in money moving between the two sides), you need
  **two wallets**: one in Community A, one in Community B. That's not busywork — the
  protocol refuses to move anything unless *both* communities vote yes, so you have to
  play both sides. A second browser profile or your phone works.

## The journey, one step at a time

Every page shows a journey bar (Verify → Join → Agree → Attest → Settle) and checks off
what you've already done, so the next step is always obvious.

### 1. Verify — prove you belong to a community · `/verify`

Two ways, pick one:

- **Your real email (genuine).** Download an email you actually received from your
  government — for Community A that's anything from `noreply@btl.gov.il` (Gmail → ⋮ →
  *Download message* gives you a `.eml`). Upload it under **“Verify with your real
  email.”** Your browser reads the DKIM signature and submits only the signed headers +
  signature; the contract verifies the RSA signature on-chain. One upload, one click.
- **Demo proof (instant).** Pick a community and click **Submit** — a structurally-real
  proof the demo verifier accepts. No email needed; for walking the flow only.

You're now an anonymous member of one community. That's the whole identity system —
no name, no document, just a nullifier on-chain.

### 2. Join — put a small pledge behind the peace · `/mint`

- If you don't have sDAI yet, click **“Get N sDAI (wrap xDAI, 1 click)”** — it wraps
  your xDAI into sDAI in a single transaction, right on the page. No external site.
- Then click **“Join — approve + convert in one click.”** It approves and converts in
  one gesture. 90% of your sDAI becomes community money in your wallet; 10% becomes your
  community's pledge (the only money the rules can ever move). You can cash the 90% back
  to sDAI anytime.

Do this on **both** wallets (Community A and Community B) if you want to reach the end.

### 3. Agree — write a rule both sides accept · `/incentives`

- **Propose** (Propose tab): the form is pre-filled with a real example (checkpoint
  removal, the Times of Israel / WAFA / Reuters / AP sources). One click submits it.
- **Vote** (Vote tab): once a proposal is in its voting window, pick how many votes
  (cost is votes², so shouting costs more), and click once — it approves the locked
  tokens and casts the vote together. Vote **yes from both wallets**.
- **Finalize**: after the ~10-minute voting window, anyone clicks Finalize. If it passed
  a majority in *each* community, the rule goes live.

### 4. Attest — turn a news event into evidence · `/attest`

Pick the active rule, then click each approved source (A-press, B-press, two
international wires) to attest it — in the demo each is a one-click structurally-real
proof. When enough distinct sources agree (≥1 A, ≥1 B, ≥2 international), the event
confirms and a countdown begins.

### 5. Settle — the promise is kept · `/pools`

- After the ~10-minute notice window, anyone clicks **Finalize** on the confirmed event.
  A capped slice (5%) of the responsible side's pledge moves to the other side.
- The harmed community's members each have an equal **claimable share** — switch to that
  wallet and click **Claim**. That's the peace dividend: same amount per person, in
  ordinary redeemable money.

That's the whole loop: an email became a membership, a pledge, a shared rule, verified
evidence, and finally a small, automatic, symmetric transfer — exactly what both sides
agreed to in advance.

## Optional extras

- **Support from anywhere · `/mint`** — not from either community? You can still
  contribute at 2× (half backs your money, half supports the shared Treasury). One click.
- **Sanctions relief · `/escrow`** — a donor locks funds against a specific rule;
  when that rule produces a finalized event, the funds release automatically. Deposit is
  one click (approve + deposit chained); release and reclaim are single clicks.

## If something looks stuck

- **“Get N sDAI first”** on the Join button → click the wrap button on the left first.
- **A vote/finalize won't go** → check the countdown; windows are ~10 minutes here.
- **The full loop won't finish with one wallet** → by design. You need a second wallet
  verified in the *other* community so both sides can vote yes.
- **Real-email upload says “key isn't registered”** → the demo currently recognizes
  btl.gov.il mail signed by its Amazon SES key; other senders need governance to add
  their key first.

## Deeper reading

- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the whole system fits together.
- [ZKEMAIL-DESIGN.md](./ZKEMAIL-DESIGN.md) — the three verification tiers and the
  on-chain DKIM/RSA verification.
- [IMPROVEMENTS.md](./IMPROVEMENTS.md) / [THREAT-MODEL.md](./THREAT-MODEL.md) — what we
  changed from the original and what it does (and doesn't) defend against.

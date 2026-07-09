import Link from "next/link"
import { Button } from "@/components/ui/button"
import { OliveBranchIcon } from "@/components/olive-branch-icon"
import { SectionHeading, HonestyNote } from "@/components/explainer"
import { HowItWorks } from "@/components/home/how-it-works"
import { PeaceCalculator } from "@/components/home/peace-calculator"
import { PeaceFlowExplainer } from "@/components/home/peace-flow-explainer"
import { HowVerificationWorks } from "@/components/home/how-verification-works"

/* Feature-parity grid: every protocol capability, each with a one-breath
   explanation and a link to where it lives (page or docs). */
const FEATURES = [
  {
    title: "zkEmail identity",
    body: "Prove citizenship from a DKIM-signed government email — client-side, zero-knowledge, address never on-chain. One inbox, one membership, renewable yearly.",
    href: "/verify",
    where: "live flow",
  },
  {
    title: "Reserve-backed dual tokens",
    body: "PEACE-A and PEACE-B are minted 1:1 against a reserve and redeem 1:1, always. No seigniorage, no depeg mechanics — the token is a receipt.",
    href: "/mint",
    where: "live flow",
  },
  {
    title: "Peace pools",
    body: "10% of every citizen mint is staked into the community pool: the only capital redistribution can ever touch. Unstaked savings are untouchable by design.",
    href: "/pools",
    where: "live flow",
  },
  {
    title: "Outsider solidarity minting",
    body: "Anyone worldwide can mint at 2× par. Half backs their tokens; half funds the shared Treasury. Money in, no governance power — capital can't buy the vote.",
    href: "/mint",
    where: "live flow",
  },
  {
    title: "Incentive proposals",
    body: "Open proposing, no fee. Keyword logic is committed as the hash of an exact zk-regex circuit — voters approve a machine, not prose. Per-event caps, trigger limits, cooldowns.",
    href: "/incentives",
    where: "live flow",
  },
  {
    title: "Quadratic dual-majority voting",
    body: "N votes lock N² tokens, one ballot per verified identity, and every incentive needs a separate YES majority in each community plus 30% participation.",
    href: "/incentives",
    where: "live flow",
  },
  {
    title: "Newsletter event oracle",
    body: "Any subscriber attests with a zkEmail proof. Distinct-source thresholds (≥1 A, ≥1 B, ≥2 international) inside a reporting window; per-email nullifiers stop double counting.",
    href: "/attest",
    where: "live flow",
  },
  {
    title: "Dispute council",
    body: "Confirmed events wait 48h before value moves. A council seated from both communities reverses bad events with a 75% supermajority — courts before bailiffs.",
    href: "/council",
    where: "live flow",
  },
  {
    title: "Equal per-member dividends",
    body: "Pool payouts are identical for every verified member — a per-citizen peace dividend, not a whale transfer. Claims follow your identity even across wallet rotation.",
    href: "/pools",
    where: "live flow",
  },
  {
    title: "Tokenized sanctions relief",
    body: "States, NGOs and diaspora escrow funds against specific incentives. A finalized event releases the tranche automatically; no event by expiry, the donor reclaims. No shifting goalposts.",
    href: "/escrow",
    where: "live flow",
  },
  {
    title: "Peace-abiding business bonus",
    body: "Businesses certified by both communities earn a Treasury bonus on every cross-community payment — commerce across the line, subsidized by the war chest (budget-capped per epoch).",
    href: "/business",
    where: "live flow",
  },
  {
    title: "DKIM key registry & guardian",
    body: "Signing keys are archived on-chain with validity windows; a leaked key is revoked instantly by the guardian, whose own pause powers auto-expire. Emergency brakes, no permanent brakeman.",
    href: "/docs",
    where: "docs",
  },
]

const PRINCIPLES = [
  {
    title: "Consent is structural",
    body: "Only opt-in stakes move; only dual-approved rules trigger; only pre-agreed amounts flow. The protocol has no power anyone didn't explicitly hand it.",
  },
  {
    title: "No collective punishment",
    body: "The original sketch confiscated from all holders — economically self-defeating and ethically the exact logic peace work exists to end. Here, harm prices land on consented stakes; rewards for de-escalation come from the shared Treasury, never from the other side.",
  },
  {
    title: "Verify, then trust",
    body: "Cryptography does the verifying (signatures, proofs, thresholds); communities do the judging (votes, disputes, councils). Neither is asked to do the other's job.",
  },
  {
    title: "Both directions, both sides",
    body: "Every mechanism is symmetric: A's aggression costs A what B's aggression costs B, and either side's de-escalation is rewarded identically. The code cannot take sides.",
  },
]

export default function HomePage() {
  return (
    <>
      {/* ------------------------------- hero ------------------------------- */}
      <section className="w-full py-16 md:py-24">
        <div className="container mx-auto grid gap-10 px-4 lg:grid-cols-[1fr_420px] lg:gap-16">
          <div className="flex flex-col justify-center space-y-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-accent/40 px-3 py-1 text-xs font-medium text-accent-foreground">
              <OliveBranchIcon className="h-4 w-4 text-primary" />
              p2p2p — peer to peer to peace · live on Gnosis Chain
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl">
              Make peace the profitable move
            </h1>
            <p className="max-w-[620px] text-muted-foreground md:text-xl">
              Citizens on both sides of a conflict line stake a slice of their own money on
              de-escalation. When verified events happen — a checkpoint removed, an attack
              carried out — value moves automatically between the sides, under rules both
              communities approved in advance. Identity and evidence come from something
              everyone already has: <span className="font-semibold text-foreground">signed email</span>.
            </p>
            <div className="flex flex-col gap-3 min-[400px]:flex-row">
              <Button size="lg" asChild>
                <Link href="/verify">Start the journey — verify</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Open source · every flow on this site executes on-chain · demo cycles run in
              minutes, not months
            </p>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative aspect-square w-full max-w-[400px] overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/60 to-secondary p-10">
              <OliveBranchIcon className="h-full w-full text-primary/80" />
            </div>
          </div>
        </div>
      </section>

      <HowItWorks />
      <PeaceCalculator />
      <PeaceFlowExplainer />
      <HowVerificationWorks />

      {/* --------------------------- design principles --------------------------- */}
      <section className="w-full py-20">
        <div className="container mx-auto px-4">
          <SectionHeading
            chip="Design principles"
            title="Rules the code cannot break"
            lede="The mechanism was audited against its own concept — what follows is what survived, and why."
          />
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="rounded-3xl border-2 border-border bg-card p-6">
                <h3 className="font-display text-lg font-bold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ feature grid ------------------------------ */}
      <section className="w-full border-t border-border bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <SectionHeading
            chip="Everything in the protocol"
            title="Twelve mechanisms, one system"
            lede="Every capability, each explained in one breath and linked to where you can use it right now."
          />
          <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Link
                key={f.title}
                href={f.href}
                className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold group-hover:text-primary">
                    {f.title}
                  </h3>
                  <span className="rounded-full bg-accent/50 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                    {f.where}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- get started ------------------------------- */}
      <section className="w-full py-20">
        <div className="container mx-auto px-4">
          <SectionHeading
            chip="Get started"
            title="Try it in ten minutes, or run it for your community"
            lede="p2p2p is free and open source. The live demo compresses governance to 10-minute cycles so you can walk the entire loop before your coffee cools."
          />
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
            <div className="flex flex-col rounded-3xl border-2 border-primary/40 bg-card p-6">
              <h3 className="font-display text-xl font-bold">Walk the live demo</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                Verify with a demo proof, mint from the faucet, pass an incentive with a friend
                (one wallet per community), attest four newsletters, ride out the 10-minute
                dispute window, claim the dividend. Everything on Gnosis, everything real.
              </p>
              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Time</dt><dd className="font-semibold">~40 minutes</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">You need</dt><dd className="font-semibold">a wallet + a little xDAI for gas</dd></div>
              </dl>
              <Button className="mt-5" asChild>
                <Link href="/verify">Start at step 1 — Verify</Link>
              </Button>
            </div>
            <div className="flex flex-col rounded-3xl border-2 border-border bg-card p-6">
              <h3 className="font-display text-xl font-bold">Deploy your own</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                Fourteen audited-in-the-open contracts, a full test suite (211 tests), zkEmail
                circuit blueprints, threat model, and one deploy script. Swap the demo verifier
                for compiled circuits and the demo domains for your communities' real ones.
              </p>
              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Time</dt><dd className="font-semibold">a weekend</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">You need</dt><dd className="font-semibold">Foundry & a cause</dd></div>
              </dl>
              <div className="mt-5 flex gap-3">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href="/docs">Documentation</Link>
                </Button>
                <Button variant="outline" className="flex-1" asChild>
                  <a href="https://github.com/RonTuretzky/p2peace-zkemail" target="_blank" rel="noreferrer">
                    Repository
                  </a>
                </Button>
              </div>
            </div>
          </div>
          <HonestyNote>
            p2p2p is an experiment in mechanism design, not a promise of peace. It prices
            events; people end wars. The docs spell out honestly what it defends against and
            what it cannot.
          </HonestyNote>
        </div>
      </section>
    </>
  )
}

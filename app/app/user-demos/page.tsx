import type React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SectionChip, SectionHeading, HonestyNote } from "@/components/explainer"

/* Walkthroughs — scripted end-to-end demo scenarios. Each is a numbered
   checklist that links into the live page for every step. */

interface Step {
  text: React.ReactNode
  wait?: boolean
}

function Checklist({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-5 space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${
              s.wait ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-primary/15 text-primary"
            }`}
          >
            {s.wait ? "⏱" : i + 1}
          </span>
          <span className="text-sm leading-relaxed text-muted-foreground">{s.text}</span>
        </li>
      ))}
    </ol>
  )
}

const L = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-medium text-primary underline underline-offset-4">
    {children}
  </Link>
)

export default function UserDemosPage() {
  return (
    <>
      <section className="container mx-auto px-4 py-14">
        {/* -------------------------------- hero -------------------------------- */}
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <SectionChip>Walkthroughs</SectionChip>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Three scripts, everything real
          </h1>
          <p className="text-muted-foreground md:text-lg">
            These are scripted runs through the live Gnosis deployment — every click lands a real
            transaction on real contracts. The demo compresses every governance clock (discussion,
            voting, reporting, dispute) to <strong className="text-foreground">10 minutes</strong>,
            so loops that would take weeks in production fit in an afternoon. Each page reads its
            live countdown from chain, so trust the timers you see there.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild>
              <Link href="/verify">Start walkthrough 1</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/docs">Read the diagrams first</Link>
            </Button>
          </div>
        </div>

        {/* --------------------------- before you start --------------------------- */}
        <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          <strong className="text-foreground">You need:</strong> a browser wallet with two accounts
          (the dual-majority vote needs one verified member per community — you'll play both sides),
          and a little xDAI on each for gas. Everything else — mUSD reserve, demo proofs — comes
          from faucets and buttons inside the flows. Demo identity proofs stand in for the WASM
          prover; every contract check they pass is real.
        </div>

        {/* ------------------------- walkthrough 1: solo loop ------------------------- */}
        <div className="mx-auto mt-14 max-w-3xl rounded-3xl border-2 border-primary/40 bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-xl font-bold">1 · The full peace loop, solo</h2>
            <span className="rounded-full bg-accent/60 px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
              ~40 minutes · two wallets
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The whole journey — Verify → Mint → Agree → Attest → Settle — played end to end, with
            you as one citizen of each community. By the end, an incentive you proposed will have
            fired on evidence you attested, and paid a dividend you claim.
          </p>
          <Checklist
            steps={[
              { text: <>With <strong>wallet 1</strong>, verify as Community A at <L href="/verify">/verify</L> — one click builds the demo citizenship proof and registers your nullifier.</> },
              { text: <>Still wallet 1: at <L href="/mint">/mint</L>, tap the mUSD faucet, approve, and mint. Watch the split land: 90% in your wallet, 10% into pool A's corpus.</> },
              { text: <>Switch to <strong>wallet 2</strong>, verify as Community B at <L href="/verify">/verify</L>, then faucet + mint at <L href="/mint">/mint</L>. Both rolls now have one member each.</> },
              { text: <>With either wallet, open <L href="/incentives">/incentives</L> and propose — the form pre-fills the demo news sources and pattern. Submission freezes everything on-chain.</> },
              { wait: true, text: <>Wait out the 10-minute discussion window (the card shows the live countdown).</> },
              { text: <>Vote YES from wallet 1, then YES from wallet 2 at <L href="/incentives">/incentives</L>. Casting n votes locks n² tokens — approve the lock when prompted. Two members voting also satisfies the 30% quorum.</> },
              { wait: true, text: <>Wait out the 10-minute voting window, then hit <em>Finalize</em> on the proposal and withdraw both wallets' vote stakes. The incentive is now active.</> },
              { text: <>At <L href="/attest">/attest</L>, submit demo newsletter proofs from four distinct sources — 1 community-A outlet, 1 community-B outlet, 2 international. On the fourth, thresholds are met and the event is CONFIRMED.</> },
              { wait: true, text: <>Wait out the 10-minute dispute window — this is the council's chance to reverse (it won't).</> },
              { text: <>At <L href="/pools">/pools</L>, finalize the event and watch value move. Then, with the receiving community's wallet, claim your equal-per-member peace dividend. Loop complete.</> },
            ]}
          />
        </div>

        {/* ---------------------- walkthrough 2: business loop ---------------------- */}
        <div className="mx-auto mt-8 max-w-3xl rounded-3xl border-2 border-border bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-xl font-bold">2 · The business certification loop</h2>
            <span className="rounded-full bg-accent/60 px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
              ~15 minutes · after walkthrough 1, steps 1–3
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Certify a business by vote of both communities, then pay it from across the line and
            watch the Treasury add the cooperation bonus on top — commerce subsidized, not taxed.
          </p>
          <Checklist
            steps={[
              { text: <>Prerequisite: two verified wallets holding tokens (walkthrough 1, steps 1–3).</> },
              { text: <>At <L href="/business">/business</L>, apply for certification with one wallet — that wallet's community becomes the business's side.</> },
              { text: <>Vote to approve from both wallets: certification needs a simple majority of <em>each</em> community's roll, just like everything else here.</> },
              { wait: true, text: <>Wait out the 10-minute certification poll, then finalize it. The business is now certified (and revocable by the same vote, later).</> },
              { text: <>From the wallet on the <em>other</em> side, pay the business at <L href="/business">/business</L> (approve, then pay). Because payer and business communities differ, the Treasury adds the 2% cooperation bonus — check the business balance to see the payment plus bonus arrive.</> },
            ]}
          />
        </div>

        {/* ----------------------- walkthrough 3: escrow loop ----------------------- */}
        <div className="mx-auto mt-8 max-w-3xl rounded-3xl border-2 border-border bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-xl font-bold">3 · The escrow donor loop</h2>
            <span className="rounded-full bg-accent/60 px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
              ~20 minutes · needs a passed incentive
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Play the outside donor: lock funds against an outcome, then see both endings — release
            when the event finalizes, or reclaim when the expiry passes with nothing proven. No
            shifting goalposts in either direction.
          </p>
          <Checklist
            steps={[
              { text: <>Prerequisite: an active (passed) incentive — walkthrough 1 through step 7.</> },
              { text: <>At <L href="/escrow">/escrow</L>, deposit a tranche: pick the incentive, a beneficiary (pool A, pool B, both, or Treasury), an amount (faucet mUSD at <L href="/mint">/mint</L> if needed), and an expiry. Everything is frozen at deposit.</> },
              { text: <>Path A — the outcome happens: drive the event through <L href="/attest">/attest</L> (four sources) and the dispute window, finalize at <L href="/pools">/pools</L>, then hit <em>Release</em> on your tranche. The funds pay into the beneficiary pool, claimable equally per member.</> },
              { wait: true, text: <>Path B — nothing happens: deposit a second tranche with an expiry a few minutes out, let it lapse with no finalized event, then <em>Reclaim</em> your full deposit.</> },
            ]}
          />
        </div>

        <HonestyNote>
          What's compressed here is only time and proving: 10-minute windows instead of days, and
          demo proofs instead of the ~60-second WASM prover. The contracts, checks, thresholds,
          locks, and payouts are exactly the production logic — read along on{" "}
          <a
            href="https://gnosis.blockscout.com"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Blockscout
          </a>{" "}
          (addresses on <Link href="/docs" className="underline underline-offset-4">/docs</Link>) and
          verify every step landed.
        </HonestyNote>
      </section>
    </>
  )
}

import Link from "next/link"
import { SectionHeading } from "@/components/explainer"
import { PeaceCalculator } from "@/components/home/peace-calculator"

/**
 * /tools — everything dense in one place, still in chronological order.
 * Each entry: when it happens in the story, what you do there, one sentence.
 */
const LIVE_TOOLS = [
  { day: "Day 0", href: "/verify", title: "Verify", body: "Prove citizenship from a government email — one inbox, one anonymous membership." },
  { day: "Day 0", href: "/mint", title: "Mint", body: "Faucet mUSD, then mint 1:1 — 90% yours, 10% staked into your peace pool. Outsiders mint at 2×." },
  { day: "Day 1–8", href: "/incentives", title: "Incentives", body: "Propose rules, vote quadratically, and see the dual-majority tallies both sides must pass." },
  { day: "Day 40", href: "/attest", title: "Attest", body: "Submit newsletter proofs source-by-source and watch the event tally fill." },
  { day: "Day 40–42", href: "/council", title: "Council", body: "The dispute docket: countdowns, 75% reversal threshold, member voting." },
  { day: "Day 42", href: "/pools", title: "Pools", body: "Pool balances, event settlement countdowns, finalize, and claim your dividend." },
  { day: "Ongoing", href: "/escrow", title: "Escrow", body: "Donors lock sanctions relief against specific incentives; finalized events release it." },
  { day: "Ongoing", href: "/business", title: "Business", body: "Dual-community certification and cross-community payments with a Treasury bonus." },
] as const

const EXPLAINERS = [
  { href: "/verification", title: "Verification, explained", body: "DKIM, nullifiers, key registry, privacy properties." },
  { href: "/governance", title: "Governance, explained", body: "Quadratic voting, dual majority, timelock, guardian, council." },
  { href: "/token-economics", title: "Token economics, explained", body: "Reserve invariant, the 90/10 split, Treasury flows." },
  { href: "/economic-incentives", title: "Incentives, explained", body: "Directions, caps, cooldowns, and a worked example." },
  { href: "/external-incentives", title: "Sanctions relief, explained", body: "The tranche lifecycle and why conditions can't shift." },
  { href: "/propose-incentive", title: "Proposer's guide", body: "From behavior to keyword circuit to a passing vote." },
  { href: "/user-demos", title: "Walkthroughs", body: "Scripted end-to-end demo scenarios with checklists." },
  { href: "/docs", title: "Technical docs", body: "Sequence diagrams and the deployed contract addresses." },
] as const

export default function ToolsPage() {
  return (
    <div className="container mx-auto px-4 py-14">
      <SectionHeading
        chip="Everything, in story order"
        title="Tools & deep dives"
        lede="The same chronology as the story on the front page — each step is a live tool on Gnosis, followed by the deeper explainers and one calculator."
      />

      <div className="mx-auto mt-10 max-w-3xl space-y-3">
        {LIVE_TOOLS.map((t, i) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-display text-base font-bold group-hover:text-primary">{t.title}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.day}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{t.body}</p>
            </div>
            <span aria-hidden className="text-primary">→</span>
          </Link>
        ))}
      </div>

      <div className="mx-auto mt-14 max-w-3xl">
        <h2 className="font-display text-xl font-bold">Understand it deeper</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {EXPLAINERS.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="font-display text-sm font-bold">{e.title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{e.body}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-16">
        <PeaceCalculator />
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { SectionHeading } from "@/components/explainer"

/**
 * HowItWorks — the four-beat story, crowdstake-style: each beat pairs a
 * plain-language claim with a small always-on visualization and links straight
 * into the live flow it describes.
 */

const BEATS = [
  {
    n: "01",
    title: "Two communities verify — privately",
    body: "Citizens on each side prove they receive DKIM-signed email from their own government, in zero knowledge. One inbox, one membership, one vote — and no list of names exists anywhere.",
    href: "/verify",
    cta: "Get verified",
    viz: (
      <div className="flex items-center justify-center gap-3 text-2xl">
        <span>✉️</span>
        <span className="text-primary">→</span>
        <span>🛡️</span>
        <span className="text-primary">→</span>
        <span className="rounded-lg bg-primary/15 px-2 py-1 font-mono text-xs text-primary">
          0x9f2…a1
        </span>
      </div>
    ),
  },
  {
    n: "02",
    title: "Minting is signing the peace deal",
    body: "Tokens are minted 1:1 against a full reserve — 90% to your wallet, 10% staked into your community's peace pool. That stake is the mutual exposure that makes de-escalation everyone's financial interest.",
    href: "/mint",
    cta: "Mint tokens",
    viz: (
      <div className="mx-auto flex h-10 w-full max-w-[220px] overflow-hidden rounded-lg text-[10px] font-bold">
        <div className="flex w-[90%] items-center justify-center bg-accent/70 text-accent-foreground">
          90% yours, redeemable 1:1
        </div>
        <div className="flex w-[10%] items-center justify-center bg-primary text-primary-foreground">
          10%
        </div>
      </div>
    ),
  },
  {
    n: "03",
    title: "Both sides write the triggers",
    body: "Incentives — “reward checkpoint removals”, “price cross-border attacks” — pass only with a YES majority in each community, voting quadratically, one verified identity per ballot. Nothing is imposed; everything is agreed.",
    href: "/incentives",
    cta: "Browse & vote",
    viz: (
      <div className="flex items-center justify-center gap-2 text-xs font-bold">
        <span className="rounded-lg bg-primary/15 px-2 py-1.5 text-primary">A: YES 63%</span>
        <span className="text-muted-foreground">and</span>
        <span className="rounded-lg bg-primary/15 px-2 py-1.5 text-primary">B: YES 58%</span>
        <span className="text-primary">✓</span>
      </div>
    ),
  },
  {
    n: "04",
    title: "News moves value — under both sides' rules",
    body: "When both sides' press and international wires report a triggering event, anyone attests with newsletter proofs. After a 48-hour dispute window, a capped slice moves pool-to-pool and pays out as an equal per-member dividend.",
    href: "/pools",
    cta: "Watch it settle",
    viz: (
      <div className="flex items-center justify-center gap-2 text-xs">
        <span className="text-xl">📰</span>
        <span className="text-primary">→</span>
        <span className="rounded-lg bg-amber-500/20 px-2 py-1 font-bold text-amber-700 dark:text-amber-300">
          −5% pool A
        </span>
        <span className="text-primary">→</span>
        <span className="rounded-lg bg-primary px-2 py-1 font-bold text-primary-foreground">
          +dividend, each member of B
        </span>
      </div>
    ),
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="w-full py-20">
      <div className="container mx-auto px-4">
        <SectionHeading
          chip="The journey"
          title="Peace, as a repeated game with real stakes"
          lede="Four beats, each one live on this site against the deployed contracts. Sanctions punish whole peoples; p2p2p prices individual events — both directions, both sides, by consent."
        />
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2">
          {BEATS.map((b) => (
            <div
              key={b.n}
              className="flex flex-col rounded-3xl border-2 border-border bg-card p-6 transition-shadow hover:shadow-lg"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-display text-sm font-bold text-primary">{b.n}</span>
                <h3 className="font-display text-lg font-bold">{b.title}</h3>
              </div>
              <div className="my-5 rounded-2xl bg-muted/50 py-4">{b.viz}</div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
              <Link
                href={b.href}
                className="mt-4 text-sm font-semibold text-primary hover:underline"
              >
                {b.cta} →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

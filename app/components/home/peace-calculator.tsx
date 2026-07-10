"use client"

import { useMemo, useState } from "react"
import { SectionHeading, StatPill, HonestyNote } from "@/components/explainer"
import { cn } from "@/lib/utils"

/**
 * PeaceCalculator
 * ---------------
 * Crowdstake-style "real math, adjustable assumptions" widget, for peace pools:
 * given community size and average mint, show the pool corpus, what one
 * confirmed event actually moves (5% cap), the per-member dividend on the other
 * side, and what outsider solidarity adds to the Treasury.
 */

const PRESETS = [
  { key: "border", label: "Border towns", members: 2_500, avgMint: 120, outsiders: 400 },
  { key: "cities", label: "Sister cities", members: 25_000, avgMint: 80, outsiders: 3_000 },
  { key: "diaspora", label: "Diaspora network", members: 8_000, avgMint: 250, outsiders: 12_000 },
  { key: "custom", label: "Custom", members: 1_000, avgMint: 100, outsiders: 500 },
] as const

const STAKE_BPS = 1_000 // 10% of every citizen mint is staked
const EVENT_BPS = 500 //   5% of pool corpus per confirmed event (cap)
const PREMIUM = 2 //       outsiders pay 2x par; the premium half funds the Treasury

const usd = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `$${Math.round(n / 1_000).toLocaleString()}k`
      : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export function PeaceCalculator() {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("border")
  const [members, setMembers] = useState(2_500)
  const [avgMint, setAvgMint] = useState(120)
  const [outsiders, setOutsiders] = useState(400)

  const pick = (p: (typeof PRESETS)[number]) => {
    setPreset(p.key)
    setMembers(p.members)
    setAvgMint(p.avgMint)
    setOutsiders(p.outsiders)
  }

  const out = useMemo(() => {
    const minted = members * avgMint
    const corpus = (minted * STAKE_BPS) / 10_000
    const perEvent = (corpus * EVENT_BPS) / 10_000
    const dividend = perEvent / members // equal-per-member on the receiving side
    const treasuryMo = outsiders * avgMint * (PREMIUM - 1) // premium half, per month of outsider volume
    const positiveReward = (treasuryMo * EVENT_BPS) / 10_000
    return { minted, corpus, perEvent, dividend, treasuryMo, positiveReward }
  }, [members, avgMint, outsiders])

  return (
    <section id="calculator" className="w-full border-t border-border bg-muted/30 py-20">
      <div className="container mx-auto px-4">
        <SectionHeading
          chip="Peace pool calculator"
          title="What does a community's pledge look like at scale?"
          lede="Real math, adjustable assumptions — 90% of every mint stays in the minter's wallet. Model a community on each side of a conflict line and see what stands behind their word."
        />

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-[380px_1fr]">
          {/* inputs */}
          <div className="rounded-3xl border-2 border-border bg-card p-6">
            <p className="text-sm font-semibold">Start from a community like yours</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => pick(p)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    preset === p.key
                      ? "border-primary bg-accent/50 text-accent-foreground"
                      : "border-border text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <Slider
              label="Verified members (each side)"
              value={members}
              min={100}
              max={100_000}
              step={100}
              onChange={(v) => {
                setMembers(v)
                setPreset("custom")
              }}
              display={members.toLocaleString()}
            />
            <Slider
              label="Average mint per member"
              value={avgMint}
              min={10}
              max={1_000}
              step={10}
              onChange={(v) => {
                setAvgMint(v)
                setPreset("custom")
              }}
              display={usd(avgMint)}
              hint="90% stays in their wallet — always redeemable 1:1"
            />
            <Slider
              label="Outsider mints per month"
              value={outsiders}
              min={0}
              max={50_000}
              step={100}
              onChange={(v) => {
                setOutsiders(v)
                setPreset("custom")
              }}
              display={outsiders.toLocaleString()}
              hint="Diaspora & allies pay 2× par — the extra supports the shared Treasury"
            />
          </div>

          {/* outputs */}
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl border-2 border-primary/40 bg-card p-6">
              <p className="text-xs font-medium text-muted-foreground">
                Peace pool corpus, per community
              </p>
              <p className="font-display text-4xl font-bold text-primary">{usd(out.corpus)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                10% of {usd(out.minted)} minted — the only money the rules can ever touch
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatPill
                tone="risk"
                label="One broken promise moves"
                value={usd(out.perEvent)}
                hint="at most 5% per event, from the pledge toward repair"
              />
              <StatPill
                tone="positive"
                label="Repair, per person"
                value={usd(out.dividend)}
                hint="the same share to every member of the harmed community"
              />
              <StatPill
                label="Treasury inflow / month"
                value={usd(out.treasuryMo)}
                hint={`from supporters worldwide; one peace-step reward ≈ ${usd(out.positiveReward)}`}
              />
            </div>
            <div className="rounded-2xl bg-accent/30 p-4 text-sm text-accent-foreground">
              <span className="font-semibold">Read it like this:</span> when a promise is broken
              and verified, <span className="font-semibold">{usd(out.perEvent)}</span> moves from
              the responsible community&apos;s pledge toward repair — {usd(out.dividend)} to each
              person on the harmed side — every time, automatically, under rules both sides wrote
              together. Steps <em>toward</em> peace are met from the shared Treasury instead, so
              honoring them never costs the other community anything.
            </div>
          </div>
        </div>

        <HonestyNote>
          Illustration, not a promise — pool sizes depend on real people joining, and every
          number here (pledge share, per-event cap, thresholds) is decided by both communities
          together. Savings never move: only the consented 10% pledge is ever involved, and
          everything else redeems 1:1 at any time.
        </HonestyNote>
      </div>
    </section>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display: string
  hint?: string
}) {
  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="font-display text-sm font-bold text-primary">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--primary)]"
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

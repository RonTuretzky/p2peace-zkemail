"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle, Lock, Pause, Play, CaretLeft, CaretRight } from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

/* Shared building blocks for the crowdstake-style explainer language:
   chip + heading + lede sections, autoplaying stepper explainers with a
   persistent diagram, honesty notes, and the app-wide journey bar. */

export function SectionChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/30 bg-accent/40 px-3 py-1 text-xs font-semibold text-accent-foreground">
      {children}
    </span>
  )
}

export function SectionHeading({
  chip,
  title,
  lede,
}: {
  chip: string
  title: string
  lede: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <SectionChip>{chip}</SectionChip>
      <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mx-auto mt-4 text-muted-foreground md:text-lg">{lede}</p>
    </div>
  )
}

/** The honest fine print — crowdstake-style "illustration, not a promise". */
export function HonestyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  )
}

/* ------------------------------ StepperExplainer ------------------------------ */

export interface ExplainerStep {
  key: string
  short: string
  title: string
  body: string
  chip: string
  icon: Icon
}

/**
 * Generic autoplaying stepped explainer with a persistent diagram: the diagram
 * stays mounted while each step highlights a different part of it and swaps in
 * a plain-language explanation. Manual navigation pauses the reel; respects
 * prefers-reduced-motion.
 */
export function StepperExplainer({
  steps,
  diagram,
  autoplayMs = 6500,
}: {
  steps: ExplainerStep[]
  diagram: (activeKey: string) => React.ReactNode
  autoplayMs?: number
}) {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    if (!playing || reducedMotion) return
    const id = window.setTimeout(() => setActive((i) => (i + 1) % steps.length), autoplayMs)
    return () => window.clearTimeout(id)
  }, [active, playing, reducedMotion, steps.length, autoplayMs])

  const go = useCallback(
    (i: number) => {
      setActive(((i % steps.length) + steps.length) % steps.length)
      setPlaying(false)
    },
    [steps.length],
  )

  const s = steps[active]
  const Icon = s.icon

  return (
    <div className="mt-12 overflow-hidden rounded-3xl border-2 border-border bg-card shadow-xl">
      {diagram(s.key)}

      {/* Step rail */}
      <div className="border-t border-border bg-muted/40">
        <ol className="flex flex-wrap">
          {steps.map((step, i) => {
            const isActive = i === active
            return (
              <li key={step.key} className="flex-1 basis-28">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "group flex w-full items-center gap-2 border-b-2 px-3 py-3 transition-colors",
                    isActive ? "border-primary bg-card" : "border-transparent hover:bg-card/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 flex-none items-center justify-center rounded-full font-display text-sm font-bold transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-left text-sm font-semibold transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.short}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Active step detail */}
      <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-start sm:p-8">
        <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-primary/10">
          <Icon size={28} weight="bold" className="text-primary" />
        </div>
        <div key={s.key} className={reducedMotion ? undefined : "animate-in fade-in duration-500"}>
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="font-display text-lg font-bold">{s.title}</h4>
            <span className="rounded-full bg-accent/60 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
              {s.chip}
            </span>
          </div>
          <p className="mt-2 leading-relaxed text-muted-foreground">{s.body}</p>
        </div>
        <div className="flex items-center gap-1 self-center">
          <button
            type="button"
            onClick={() => go(active - 1)}
            aria-label="Previous step"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CaretLeft size={18} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause" : "Play"}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {playing ? <Pause size={18} weight="bold" /> : <Play size={18} weight="bold" />}
          </button>
          <button
            type="button"
            onClick={() => go(active + 1)}
            aria-label="Next step"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CaretRight size={18} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------- JourneyBar --------------------------------- */

export const JOURNEY = [
  { href: "/verify", label: "Verify", blurb: "one email, one identity" },
  { href: "/mint", label: "Mint", blurb: "1:1, with a small pledge" },
  { href: "/incentives", label: "Agree", blurb: "both sides vote yes" },
  { href: "/attest", label: "Attest", blurb: "newsletters as evidence" },
  { href: "/pools", label: "Settle", blurb: "dispute, then repair" },
] as const

/**
 * The one journey every page shares. `current` highlights where the visitor is;
 * `done` marks completed prerequisites (e.g. verified, holds tokens) so the
 * next step is always obvious.
 */
export function JourneyBar({
  current,
  done = [],
}: {
  current: (typeof JOURNEY)[number]["href"]
  done?: string[]
}) {
  return (
    <nav aria-label="Protocol journey" className="mx-auto mt-8 max-w-4xl">
      <ol className="flex flex-wrap items-stretch justify-center gap-2">
        {JOURNEY.map((step, i) => {
          const isCurrent = step.href === current
          const isDone = done.includes(step.href)
          return (
            <li key={step.href} className="flex items-center gap-2">
              <Link
                href={step.href}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors",
                  isCurrent
                    ? "border-primary bg-accent/40"
                    : "border-border hover:border-primary/50",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold",
                    isDone
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {isDone ? <CheckCircle size={14} weight="bold" /> : i + 1}
                </span>
                <span className="text-left">
                  <span
                    className={cn(
                      "block text-sm font-semibold",
                      isCurrent ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {step.blurb}
                  </span>
                </span>
              </Link>
              {i < JOURNEY.length - 1 && (
                <span aria-hidden className="hidden text-muted-foreground/50 sm:inline">
                  →
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Small labeled stat used across calculator and pool visualizations. */
export function StatPill({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: React.ReactNode
  hint?: string
  tone?: "default" | "positive" | "risk"
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "positive" && "border-primary/40 bg-accent/30",
        tone === "risk" && "border-amber-500/40 bg-amber-500/5",
        tone === "default" && "border-border bg-card",
      )}
    >
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

/** Inline lock/prereq callout used on app pages to make the journey obvious. */
export function PrereqNote({
  met,
  children,
  href,
  cta,
}: {
  met: boolean
  children: React.ReactNode
  href: string
  cta: string
}) {
  if (met) return null
  return (
    <div className="mx-auto mt-6 flex max-w-xl items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
      <Lock size={20} weight="bold" className="flex-none text-amber-600" />
      <span className="text-muted-foreground">{children}</span>
      <Link
        href={href}
        className="ml-auto flex-none rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
      >
        {cta}
      </Link>
    </div>
  )
}

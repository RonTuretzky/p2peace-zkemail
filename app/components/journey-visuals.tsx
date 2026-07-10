import type { ReactNode } from "react"
import {
  EnvelopeSimple,
  ShieldCheck,
  User,
  Coins,
  Wallet,
  Handshake,
  Newspaper,
  FileMagnifyingGlass,
  LockSimple,
  Eye,
  HandCoins,
  Storefront,
  Buildings,
  Gift,
  GlobeHemisphereWest,
  Scales,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "@/lib/utils"

/**
 * Journey visualizations — one bespoke, purely-CSS-animated scene per chapter
 * of the story (crowdstake.fun's how-it-works pattern). Each scene loops
 * gently via the `.p2p-*` keyframes in globals.css, reads correctly at rest,
 * and goes static under prefers-reduced-motion. Shared between the story on
 * the home page and the matching live-tool pages.
 */

export function VisualFrame({
  children,
  caption,
  className,
}: {
  children: ReactNode
  caption: string
  className?: string
}) {
  return (
    <figure
      className={cn(
        "relative flex h-56 items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-gradient-to-b from-accent/20 to-card shadow-sm",
        className,
      )}
    >
      {children}
      <figcaption className="absolute bottom-2.5 left-4 right-4 truncate text-right text-xs font-medium text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  )
}

/* --------------------------- 1 · Verify (identity) --------------------------- */

export function VizVerify() {
  return (
    <div className="flex w-full max-w-[19rem] items-end justify-between px-5 pb-6">
      {(["A", "B"] as const).map((side, s) => (
        <div key={side} className="flex flex-col items-center gap-1.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <User size={18} weight="bold" className="text-primary" />
          </span>
          <div className="relative h-10 w-6">
            <EnvelopeSimple
              size={16}
              weight="bold"
              className="p2p-drop absolute left-1/2 top-0 -translate-x-1/2 text-primary"
              style={{ animationDelay: `${s * 1.3}s` }}
            />
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-primary/40 bg-primary/5">
            <ShieldCheck size={20} weight="bold" className="text-primary" />
          </span>
          <span
            className="p2p-pulse rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary"
            style={{ animationDelay: `${s * 1.3 + 0.6}s` }}
          >
            member of {side}
          </span>
        </div>
      ))}
      <div className="mb-8 flex flex-col items-center gap-1 text-center">
        <span className="text-[10px] font-semibold text-muted-foreground">
          gov email in
          <br />
          anonymous
          <br />
          membership out
        </span>
      </div>
    </div>
  )
}

/* ----------------------------- 2 · Join (pledge) ----------------------------- */

export function VizPledge() {
  const coins = [
    { left: "18%", delay: "0s" },
    { left: "38%", delay: "0.65s" },
    { left: "58%", delay: "1.3s" },
    { left: "78%", delay: "1.95s" },
  ]
  return (
    <div className="flex w-full max-w-[16rem] flex-col items-center gap-2 px-4 pb-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
        <User size={18} weight="bold" className="text-primary" />
      </span>
      <div className="relative h-8 w-full">
        {coins.map((c, i) => (
          <span
            key={i}
            className="p2p-drop absolute top-0 h-2.5 w-2.5 rounded-full bg-primary"
            style={{ left: c.left, animationDelay: c.delay }}
          />
        ))}
      </div>
      <div className="flex w-full gap-2">
        <div className="flex h-16 w-[90%] flex-col items-center justify-center rounded-xl border-2 border-border bg-card">
          <Wallet size={18} weight="duotone" className="text-foreground" />
          <span className="text-[10px] font-semibold">90% your wallet</span>
        </div>
        <div className="relative h-16 w-[10%] min-w-9 overflow-hidden rounded-xl border-2 border-primary/40">
          <div className="p2p-fill absolute inset-x-0 bottom-0 bg-primary/25" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-bold text-primary">10%</span>
          </div>
        </div>
      </div>
      <span className="text-[10px] font-semibold text-primary">→ the peace pool: your community's pledge</span>
    </div>
  )
}

/* ----------------------------- 3 · Agree (rules) ----------------------------- */

export function VizRules() {
  return (
    <div className="flex w-full max-w-[16rem] flex-col gap-2.5 px-5 pb-5">
      <div className="rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 font-mono text-[9px] leading-tight text-muted-foreground">
        IF checkpoint removed AND both presses + wires report → reward the step
      </div>
      {(
        [
          { label: "Community A votes", w: "78%", delay: "0s" },
          { label: "Community B votes", w: "64%", delay: "0.4s" },
        ] as const
      ).map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-[10px] font-medium text-muted-foreground">
            <span>{r.label}</span>
            <span className="font-bold text-primary">YES</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="p2p-bar h-full rounded-full bg-primary"
              style={{ width: r.w, animationDelay: r.delay }}
            />
          </div>
        </div>
      ))}
      <span
        className="p2p-pulse mx-auto mt-1 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary"
        style={{ animationDelay: "1.6s" }}
      >
        <Handshake size={13} weight="bold" /> rule active — both sides said yes
      </span>
    </div>
  )
}

/* ---------------------------- 4 · The event happens ---------------------------- */

export function VizEvent() {
  return (
    <div className="flex w-full max-w-[17rem] items-center justify-between gap-2 px-5 pb-5">
      <div className="flex h-16 w-16 flex-none flex-col items-center justify-center rounded-xl border-2 border-border bg-card">
        <Newspaper size={20} weight="duotone" className="text-primary" />
        <span className="mt-0.5 text-[9px] font-semibold text-muted-foreground">newsroom</span>
      </div>
      <div className="relative h-8 w-14 flex-none">
        {[0, 1, 2].map((i) => (
          <EnvelopeSimple
            key={i}
            size={13}
            weight="bold"
            className="p2p-flow absolute top-1/2 text-primary"
            style={{ animationDelay: `${i * 0.55}s` }}
          />
        ))}
      </div>
      <div className="flex flex-none flex-col gap-1.5">
        {["inbox", "inbox", "inbox"].map((t, i) => (
          <span
            key={i}
            className="p2p-pulse flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary"
            style={{ animationDelay: `${i * 0.55}s` }}
          >
            <EnvelopeSimple size={11} weight="bold" /> {t}
          </span>
        ))}
      </div>
      <div className="flex-none text-center">
        <span className="p2p-rise inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">
          <ShieldCheck size={11} weight="bold" /> signed at send
        </span>
      </div>
    </div>
  )
}

/* ------------------------- 5 · Attest (evidence tally) ------------------------- */

export function VizEvidence() {
  const slots = [
    { label: "A-press", delay: "0s" },
    { label: "B-press", delay: "0.9s" },
    { label: "wire 1", delay: "1.8s" },
    { label: "wire 2", delay: "2.7s" },
  ]
  return (
    <div className="flex w-full max-w-[16rem] flex-col items-center gap-3 px-5 pb-5">
      <div className="flex items-center gap-2">
        <EnvelopeSimple size={18} weight="bold" className="text-muted-foreground" />
        <span className="text-primary">→</span>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-primary/40 bg-primary/5">
          <FileMagnifyingGlass size={20} weight="bold" className="text-primary" />
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">
          proof in the browser —<br />
          the email stays home
        </span>
      </div>
      <div className="flex gap-1.5">
        {slots.map((s) => (
          <span
            key={s.label}
            className="p2p-slot rounded-lg bg-primary px-2 py-1.5 text-[10px] font-bold text-primary-foreground"
            style={{ animationDelay: s.delay }}
          >
            {s.label} ✓
          </span>
        ))}
      </div>
      <span className="text-[10px] font-semibold text-primary">
        both sides + the world, before anything counts
      </span>
    </div>
  )
}

/* --------------------------- 6 · Daylight (dispute) --------------------------- */

export function VizDaylight() {
  return (
    <div className="flex w-full max-w-[16rem] flex-col items-center gap-3 px-5 pb-5">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-border bg-card">
          <LockSimple size={22} weight="bold" className="text-foreground" />
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground">
            nothing moves for 48 hours
          </span>
          <div className="h-2 w-36 overflow-hidden rounded-full bg-muted">
            <div className="p2p-drain h-full rounded-full bg-amber-500/70" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="p2p-rise flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card"
            style={{ animationDelay: `${i * 0.4}s` }}
          >
            <Eye size={15} weight="bold" className="text-primary" />
          </span>
        ))}
        <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
          <Scales size={12} weight="bold" /> public notice · guardian can pause
        </span>
      </div>
    </div>
  )
}

/* ------------------------- 7 · Settle (promise kept) ------------------------- */

export function VizSettle() {
  return (
    <div className="flex w-full max-w-[17rem] items-end justify-between gap-2 px-5 pb-6">
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-24 w-16 flex-col justify-end gap-1 rounded-xl border-2 border-border bg-card p-1.5">
          <div className="p2p-shrink-y flex h-[70%] items-end justify-center rounded-md bg-amber-500/30 pb-1">
            <span className="text-[8px] font-bold text-amber-800 dark:text-amber-200">pledge</span>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground">pool A</span>
      </div>
      <div className="relative h-8 w-14 flex-none self-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="p2p-flow absolute top-1/2 h-2 w-2 rounded-full bg-primary"
            style={{ animationDelay: `${i * 0.5}s` }}
          />
        ))}
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-24 w-16 flex-col justify-end gap-1 rounded-xl border-2 border-primary/40 bg-card p-1.5">
          <div className="p2p-grow-y flex h-[45%] items-end justify-center rounded-md bg-primary pb-1">
            <span className="text-[8px] font-bold text-primary-foreground">repair</span>
          </div>
          <div className="flex h-[38%] items-center justify-center rounded-md bg-primary/20">
            <span className="text-[8px] font-bold text-primary">pledge</span>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground">pool B</span>
      </div>
      <span className="mb-8 max-w-[4.5rem] text-center text-[9px] font-medium text-muted-foreground">
        at most 5%, only after the window
      </span>
    </div>
  )
}

/* ---------------------------- 8 · Repair (shares) ---------------------------- */

export function VizRepair() {
  const members = [0, 1, 2, 3, 4]
  return (
    <div className="flex w-full max-w-[16rem] flex-col items-center gap-2 px-4 pb-5">
      <div className="flex h-11 w-24 items-center justify-center gap-1 rounded-xl border-2 border-primary/40 bg-primary/5">
        <HandCoins size={16} weight="duotone" className="text-primary" />
        <span className="text-[10px] font-bold text-primary">repair</span>
      </div>
      <div className="relative h-8 w-full">
        {members.map((i) => (
          <span
            key={i}
            className="p2p-drop absolute top-0 h-2 w-2 rounded-full bg-primary"
            style={{ left: `${14 + i * 18}%`, animationDelay: `${i * 0.35}s` }}
          />
        ))}
      </div>
      <div className="flex gap-2.5">
        {members.map((i) => (
          <span
            key={i}
            className="p2p-pulse flex h-9 w-9 items-center justify-center rounded-full bg-primary/10"
            style={{ animationDelay: `${i * 0.35}s` }}
          >
            <User size={16} weight="bold" className="text-primary" />
          </span>
        ))}
      </div>
      <span className="text-[10px] font-semibold text-primary">the same share to every member</span>
    </div>
  )
}

/* -------------------------- 9 · The world joins in -------------------------- */

export function VizWorld() {
  const joiners = [
    { Icon: GlobeHemisphereWest, label: "supporters", delay: "0s" },
    { Icon: Gift, label: "donors", delay: "0.5s" },
    { Icon: Storefront, label: "businesses", delay: "1s" },
    { Icon: Buildings, label: "towns", delay: "1.5s" },
  ]
  return (
    <div className="flex w-full max-w-[17rem] items-center justify-between gap-3 px-5 pb-5">
      <div className="flex flex-none flex-col gap-1.5">
        {joiners.map(({ Icon, label, delay }) => (
          <span
            key={label}
            className="p2p-pulse flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary"
            style={{ animationDelay: delay }}
          >
            <Icon size={13} weight="bold" /> {label}
          </span>
        ))}
      </div>
      <div className="relative h-8 w-12 flex-none">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="p2p-flow absolute top-1/2 h-2 w-2 rounded-full bg-primary"
            style={{ animationDelay: `${i * 0.6}s` }}
          />
        ))}
      </div>
      <div className="relative h-24 w-20 flex-none overflow-hidden rounded-xl border-2 border-primary/40">
        <div className="p2p-fill absolute inset-x-0 bottom-0 bg-primary/25" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Coins size={20} weight="duotone" className="text-primary" />
          <span className="mt-0.5 text-[9px] font-semibold text-primary">
            shared
            <br />
            Treasury
          </span>
        </div>
      </div>
    </div>
  )
}

/* -------------------------- 10 · Year 1 (groceries) -------------------------- */

export function VizYearOne() {
  const shops = ["grocer", "mechanic", "pharmacy"]
  return (
    <div className="flex w-full max-w-[17rem] flex-col items-center gap-3 px-5 pb-5">
      <div className="flex items-center gap-2">
        {shops.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className="p2p-pulse flex h-12 w-14 flex-col items-center justify-center rounded-xl border-2 border-primary/30 bg-primary/5"
              style={{ animationDelay: `${i * 0.6}s` }}
            >
              <Storefront size={16} weight="bold" className="text-primary" />
              <span className="text-[8px] font-semibold text-muted-foreground">{s}</span>
            </span>
            {i < shops.length - 1 && (
              <div className="relative h-6 w-8">
                <span
                  className="p2p-flow absolute top-1/2 h-1.5 w-1.5 rounded-full bg-primary"
                  style={{ animationDelay: `${i * 0.6 + 0.3}s` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <span className="text-center text-[10px] font-semibold text-primary">
        every purchase keeps value with neighbors
      </span>
    </div>
  )
}

/* --------------------------- 11 · Year 5 (the shift) --------------------------- */

export function VizYearFive() {
  return (
    <div className="flex w-full max-w-[16rem] items-end justify-center gap-6 px-5 pb-6">
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-28 w-16 items-end rounded-xl border-2 border-border bg-card p-1.5">
          <div className="p2p-shrink-y h-full w-full rounded-md bg-muted-foreground/30" />
        </div>
        <span className="text-center text-[9px] font-semibold leading-tight text-muted-foreground">
          the currency
          <br />
          that funds war
        </span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-28 w-16 items-end rounded-xl border-2 border-primary/40 bg-card p-1.5">
          <div className="p2p-grow-y h-full w-full rounded-md bg-primary" />
        </div>
        <span className="text-center text-[9px] font-semibold leading-tight text-primary">
          the economy
          <br />
          neighbors govern
        </span>
      </div>
      <span className="mb-10 max-w-[4.5rem] text-[9px] font-medium text-muted-foreground">
        year after year, power follows the money
      </span>
    </div>
  )
}

/* ------------------------- 12 · Year 20 (grown together) ------------------------- */

export function VizYearTwenty() {
  return (
    <div className="flex w-full max-w-[16rem] flex-col items-center gap-3 px-5 pb-5">
      <div className="relative flex h-24 items-center justify-center">
        <span className="p2p-merge-l flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/15 text-xs font-bold text-primary">
          A
        </span>
        <span className="p2p-merge-r -ml-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/25 text-xs font-bold text-primary">
          B
        </span>
      </div>
      <span className="text-center text-[10px] font-semibold text-primary">
        two monies, one economy — merging becomes paperwork
      </span>
    </div>
  )
}

import type React from "react"
import Link from "next/link"

/**
 * The Story — the whole system told once, chronologically, one idea per
 * chapter, following two people (Amira in community A, Boaz in community B)
 * from an email in their inboxes to a promise kept.
 *
 * Design: a single column on a vertical timeline spine. Each chapter is a day
 * marker, a title, two or three sentences, one small visual, and at most one
 * link. Nothing competes for attention; the order does the explaining.
 *
 * Voice: warm, plain, quietly confident (Bread voice guide). The money is a
 * pledge that makes commitments credible — never the point of the story.
 */

function Chapter({
  day,
  title,
  children,
  visual,
  link,
}: {
  day: string
  title: string
  children: React.ReactNode
  visual?: React.ReactNode
  link?: { href: string; label: string }
}) {
  return (
    <li className="relative pb-16 pl-8 last:pb-0 sm:pl-12">
      {/* spine dot */}
      <span
        aria-hidden
        className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-4 border-background bg-primary"
      />
      <div className="text-xs font-bold uppercase tracking-wider text-primary">{day}</div>
      <h3 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h3>
      <div className="mt-3 max-w-xl space-y-3 leading-relaxed text-muted-foreground">
        {children}
      </div>
      {visual && <div className="mt-5 max-w-xl rounded-2xl border border-border bg-card p-5">{visual}</div>}
      {link && (
        <Link
          href={link.href}
          className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
        >
          {link.label} →
        </Link>
      )}
    </li>
  )
}

/* ------------------------------ tiny visuals ------------------------------ */

function VizVerify() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-around">
      {[
        { name: "Amira", side: "A", domain: "taxes.gov-a" },
        { name: "Boaz", side: "B", domain: "id.gov-b" },
      ].map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-sm">
          <span className="text-xl">✉️</span>
          <span className="text-muted-foreground">{p.domain}</span>
          <span className="text-primary">→</span>
          <span className="text-xl">🛡️</span>
          <span className="font-semibold">
            {p.name} <span className="font-normal text-muted-foreground">member of {p.side}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function VizMint() {
  return (
    <div>
      <div className="flex h-9 w-full overflow-hidden rounded-lg text-[11px] font-bold">
        <div className="flex w-[90%] items-center justify-center bg-accent/70 text-accent-foreground">
          $90 stays in Amira&apos;s wallet — redeemable 1:1, any time
        </div>
        <div className="flex w-[10%] items-center justify-center bg-primary text-primary-foreground">
          $10
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        The $10 joins <span className="font-semibold text-foreground">peace pool A</span> —
        Amira's community's shared pledge. Boaz's does the same on his side. A thousand people
        each, and both communities have put their word where the other side can see it.
      </p>
    </div>
  )
}

function VizAgree() {
  return (
    <div className="space-y-2 text-sm">
      <p className="rounded-lg bg-muted p-3 font-mono text-xs">
        “IF (checkpoint removal) AND (Jordan Valley) reported by ≥1 A-outlet, ≥1 B-outlet, ≥2
        international wires → reward community A from the Treasury”
      </p>
      <div className="flex items-center justify-center gap-2 text-xs font-bold">
        <span className="rounded-lg bg-primary/15 px-2 py-1.5 text-primary">Community A: YES</span>
        <span className="text-muted-foreground">and</span>
        <span className="rounded-lg bg-primary/15 px-2 py-1.5 text-primary">Community B: YES</span>
        <span className="text-primary text-base">✓ rule active</span>
      </div>
    </div>
  )
}

function VizAttest() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
      <span className="text-xl">📰</span>
      {[
        { l: "A-press", ok: true },
        { l: "B-press", ok: true },
        { l: "wire #1", ok: true },
        { l: "wire #2", ok: true },
      ].map((s) => (
        <span
          key={s.l}
          className="rounded-lg bg-primary px-2 py-1 font-bold text-primary-foreground"
        >
          {s.l} ✓
        </span>
      ))}
      <span className="w-full text-center text-muted-foreground">
        four different newsrooms, four signed emails, four proofs — event confirmed
      </span>
    </div>
  )
}

function VizTwoDirections() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-primary/40 bg-accent/30 p-3 text-xs">
        <div className="font-bold text-accent-foreground">A step toward peace</div>
        <p className="mt-1 text-muted-foreground">
          Treasury → the acting side's pool. Rewarding de-escalation never costs the other
          community a cent.
        </p>
      </div>
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
        <div className="font-bold">A verified harm</div>
        <p className="mt-1 text-muted-foreground">
          Up to 5% of the responsible side's pool → the harmed side's rewards. Only the staked
          10% is ever reachable — never anyone's savings.
        </p>
      </div>
    </div>
  )
}

function VizDividend() {
  return (
    <div className="text-center text-sm">
      <div className="flex items-center justify-center gap-2">
        <span className="rounded-lg bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
          pool moves $500
        </span>
        <span className="text-primary">→</span>
        <span className="rounded-lg bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
          $0.50 to each of 1,000 members
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        The same share to each person — repair that reaches people, not portfolios. Boaz claims
        his; it's an ordinary token, redeemable 1:1.
      </p>
    </div>
  )
}

/* --------------------------------- story --------------------------------- */

export function Story() {
  return (
    <section id="story" className="w-full py-16">
      <div className="container mx-auto max-w-3xl px-4">
        <ol className="border-l-2 border-border">
          <Chapter day="Day 0 · identity" title="Amira and Boaz verify — privately" visual={<VizVerify />} link={{ href: "/verify", label: "Do this step live" }}>
            <p>
              Amira lives in community A, Boaz in community B. Their governments already email
              them — tax receipts, ID-portal notices — and every such email carries a
              cryptographic signature from the sender's own mail servers.
            </p>
            <p>
              Each proves, from a saved email and entirely on their own device, that they receive
              government mail — without revealing the email, or even their address. The chain
              records one anonymous membership per inbox. That's the whole identity system: no
              documents, no biometrics, no list of names anywhere.
            </p>
          </Chapter>

          <Chapter day="Day 0 · the pledge" title="They each put $100 behind the peace" visual={<VizMint />} link={{ href: "/mint", label: "Do this step live" }}>
            <p>
              The tokens themselves are boring on purpose: backed one-for-one by a full reserve,
              redeemable one-for-one, forever. What matters is the split — 90% stays in your
              wallet, and 10% goes into your community's <em>peace pool</em>.
            </p>
            <p>
              That pledge is the only money these tools can ever touch, and joining is how you
              consent to it. Think of it as your community's word, made tangible — a promise
              each side makes to the other, held where everyone can see it.
            </p>
          </Chapter>

          <Chapter day="Day 1–8 · rules" title="Both sides write a rule — together" visual={<VizAgree />} link={{ href: "/incentives", label: "Browse & vote live" }}>
            <p>
              Anyone may propose an incentive: a precise, machine-checkable sentence about the
              world. The keyword logic is committed as the hash of an exact circuit, so voters
              approve a machine, not prose that can be reinterpreted later.
            </p>
            <p>
              After a week of discussion, it passes only with a separate YES-majority in{" "}
              <em>each</em> community — one verified person, one ballot, and speaking louder
              costs more than speaking once, so no one can simply outspend their neighbors.
              Neither side can ever impose a rule on the other.
            </p>
          </Chapter>

          <Chapter day="Day 40 · the event" title="A checkpoint comes down">
            <p>
              Something real happens in the world. Newsrooms on both sides and international
              wires report it — and every newsletter they send is automatically signed by their
              mail servers, the same signature system your inbox already trusts.
            </p>
            <p>
              The evidence now sits, frozen and provable, in millions of inboxes. There is no
              monitoring service to censor, bribe, or take offline.
            </p>
          </Chapter>

          <Chapter day="Day 40 · evidence" title="Anyone with the email proves it" visual={<VizAttest />} link={{ href: "/attest", label: "Attest live" }}>
            <p>
              Any subscriber — Amira, Boaz, a stranger in Lisbon — generates a proof in their
              browser: <em>this signed email, from this approved outlet, matches the rule's
              exact keywords.</em> The proof shows the fact and nothing else; the email itself
              never leaves their machine.
            </p>
            <p>
              One outlet is never enough. The event confirms only with distinct sources from
              community A, community B, <em>and</em> the international press — each email counted
              once.
            </p>
          </Chapter>

          <Chapter day="Day 40–42 · daylight" title="48 hours where nothing moves" link={{ href: "/council", label: "See the council docket" }}>
            <p>
              Confirmation starts a clock, not a transfer. For 48 hours the event sits in
              daylight, and a dispute council seated from both communities can reverse it with a
              75% supermajority. Cryptography narrows what needs judging; humans still judge.
            </p>
          </Chapter>

          <Chapter day="Day 42 · the promise kept" title="The rules do what both sides agreed" visual={<VizTwoDirections />} link={{ href: "/pools", label: "Watch pools settle live" }}>
            <p>
              The window closes untouched, and the rules carry out exactly what both
              communities wrote together. Everything is symmetric: what holds A to its word
              holds B the same way, and either side's step toward peace is met identically.
            </p>
          </Chapter>

          <Chapter day="Day 42 · repair" title="Every member gets the same share" visual={<VizDividend />} link={{ href: "/pools", label: "Claim live" }}>
            <p>
              Repair goes to people, not to balances: every member of the harmed community
              receives the same share, whether they hold a little or a lot, and it follows your
              membership even if you change wallets. A small thing arriving in an ordinary
              wallet — and a sign, each time, that the promise held.
            </p>
          </Chapter>

          <Chapter day="Every day after · the world joins" title="Outsiders, donors, and businesses compound it">
            <p>
              Three more doors, all optional:{" "}
              <Link href="/mint" className="font-medium text-primary hover:underline">
                outsiders mint at 2×
              </Link>{" "}
              (half funds the shared Treasury — money in, no vote),{" "}
              <Link href="/escrow" className="font-medium text-primary hover:underline">
                donors escrow sanctions relief
              </Link>{" "}
              that releases automatically on verified milestones, and{" "}
              <Link href="/business" className="font-medium text-primary hover:underline">
                businesses certified by both communities
              </Link>{" "}
              earn a bonus on every cross-community sale.
            </p>
          </Chapter>
        </ol>
      </div>
    </section>
  )
}

import type React from "react"
import Link from "next/link"
import {
  VisualFrame,
  VizVerify,
  VizPledge,
  VizRules,
  VizEvent,
  VizEvidence,
  VizDaylight,
  VizSettle,
  VizRepair,
  VizWorld,
  VizYearOne,
  VizYearFive,
  VizYearTwenty,
} from "@/components/journey-visuals"

/**
 * The Story — the whole system told once, chronologically, one idea per
 * chapter, following two people (Amira in community A, Boaz in community B)
 * from an email in their inboxes to a promise kept.
 *
 * Design: a single column on a vertical timeline spine. Each chapter is a day
 * marker, a title, two or three sentences, one animated scene (see
 * journey-visuals.tsx — crowdstake-style looping CSS animations), and at most
 * one link. Nothing competes for attention; the order does the explaining.
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
      {visual && <div className="mt-5 max-w-xl">{visual}</div>}
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

export function Story() {
  return (
    <section id="story" className="w-full py-16">
      <div className="container mx-auto max-w-3xl px-4">
        <ol className="border-l-2 border-border">
          <Chapter
            day="Day 0 · identity"
            title="Amira and Boaz verify — privately"
            visual={
              <VisualFrame caption="a government email in → an anonymous membership out">
                <VizVerify />
              </VisualFrame>
            }
            link={{ href: "/verify", label: "Do this step live" }}
          >
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

          <Chapter
            day="Day 0 · the pledge"
            title="They each put $100 behind the peace"
            visual={
              <VisualFrame caption="90% stays yours · 10% becomes the community's pledge">
                <VizPledge />
              </VisualFrame>
            }
            link={{ href: "/mint", label: "Do this step live" }}
          >
            <p>
              The money itself is boring on purpose: every unit is backed one-for-one by real
              money held in reserve, and you can cash back out any time. What matters is the
              split — 90% stays in your wallet, and 10% goes into your community's{" "}
              <em>peace pool</em>.
            </p>
            <p>
              That pledge is the only money these tools can ever touch, and joining is how you
              consent to it. Think of it as your community's word, made tangible — a promise
              each side makes to the other, held where everyone can see it.
            </p>
          </Chapter>

          <Chapter
            day="Day 1–8 · rules"
            title="Both sides write a rule — together"
            visual={
              <VisualFrame caption="no rule activates without a YES from each side">
                <VizRules />
              </VisualFrame>
            }
            link={{ href: "/incentives", label: "Browse & vote live" }}
          >
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

          <Chapter
            day="Day 40 · the event"
            title="A checkpoint comes down"
            visual={
              <VisualFrame caption="the evidence lands, signed, in millions of inboxes">
                <VizEvent />
              </VisualFrame>
            }
          >
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

          <Chapter
            day="Day 40 · evidence"
            title="Anyone with the email proves it"
            visual={
              <VisualFrame caption="≥1 A-outlet · ≥1 B-outlet · ≥2 wires — each email counted once">
                <VizEvidence />
              </VisualFrame>
            }
            link={{ href: "/attest", label: "Attest live" }}
          >
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

          <Chapter
            day="Day 40–42 · daylight"
            title="48 hours where nothing moves"
            visual={
              <VisualFrame caption="confirmation starts a clock, not a transfer">
                <VizDaylight />
              </VisualFrame>
            }
            link={{ href: "/pools", label: "Watch the clock live" }}
          >
            <p>
              Confirmation starts a clock, not a transfer. For 48 hours the event sits in
              daylight where anyone can inspect it, and a guardian can pause settlement if
              something looks wrong — a brake that expires on its own, so no one can hold the
              system hostage. Cryptography narrows what needs judging; daylight does the rest.
            </p>
          </Chapter>

          <Chapter
            day="Day 42 · the promise kept"
            title="The rules do what both sides agreed"
            visual={
              <VisualFrame caption="harm: pledge → repair · steps toward peace: met from the shared Treasury">
                <VizSettle />
              </VisualFrame>
            }
            link={{ href: "/pools", label: "Watch pools settle live" }}
          >
            <p>
              The window closes untouched, and the rules carry out exactly what both
              communities wrote together. Everything is symmetric: what holds A to its word
              holds B the same way, and either side's step toward peace is met identically.
            </p>
          </Chapter>

          <Chapter
            day="Day 42 · repair"
            title="Every member gets the same share"
            visual={
              <VisualFrame caption="repair reaches people, not portfolios">
                <VizRepair />
              </VisualFrame>
            }
            link={{ href: "/pools", label: "Claim live" }}
          >
            <p>
              Repair goes to people, not to balances: every member of the harmed community
              receives the same share, whether they hold a little or a lot, and it follows your
              membership even if you change wallets. A small thing arriving in an ordinary
              wallet — and a sign, each time, that the promise held.
            </p>
          </Chapter>

          <Chapter
            day="Every day after · the world joins"
            title="Supporters, donors, and businesses compound it"
            visual={
              <VisualFrame caption="support flows in — the say stays with the two communities">
                <VizWorld />
              </VisualFrame>
            }
          >
            <p>
              More doors, all optional:{" "}
              <Link href="/mint" className="font-medium text-primary hover:underline">
                supporters worldwide can join at double the rate
              </Link>{" "}
              (half backs their money, half supports the shared Treasury — support, not a say),
              and{" "}
              <Link href="/escrow" className="font-medium text-primary hover:underline">
                donors pre-commit sanctions relief
              </Link>{" "}
              that releases automatically on verified milestones. Businesses on both sides can
              simply accept the money — and whole towns can join too, twin municipalities pooling
              for shared water, roads, and schools.
            </p>
          </Chapter>

          <Chapter
            day="Year 1 · everyday life"
            title="The money starts doing groceries"
            visual={
              <VisualFrame caption="value that used to leave the neighborhood now stays in it">
                <VizYearOne />
              </VisualFrame>
            }
          >
            <p>
              Amira's greengrocer takes community money. So does Boaz's mechanic, then a
              pharmacy, then a landlord or two. Every shop that accepts it makes it a little
              more normal — especially the ones serving customers from both sides of the line.
            </p>
            <p>
              Here is the quiet part: every purchase made in community money is value that now
              lives with neighbors — held by people on both sides, under rules both sides wrote
              — instead of sitting in the national currency that pays for the conflict.
            </p>
          </Chapter>

          <Chapter
            day="Year 5 · the shift"
            title="War gets more expensive every year"
            link={{ href: "/exit", label: "See the shekel exit, measured live" }}
            visual={
              <VisualFrame caption="escalation now loses twice — the pledge, and the economy walking away">
                <VizYearFive />
              </VisualFrame>
            }
          >
            <p>
              As more of daily life runs on community money, the currencies that fund escalation
              slowly matter less. A government that chooses violence now loses twice: the
              verified event moves its community's pledge — and the economy it commands keeps
              shrinking as people, shops, and towns quietly settle their lives in money it
              doesn't control.
            </p>
            <p>
              That is the design, stated plainly: conflict becomes a game where both sides lose
              more each passing year, and de-escalation is the only move that pays. Not because
              anyone's mind was changed — because the ground shifted under the choice.
            </p>
          </Chapter>

          <Chapter
            day="Year 20 · grown together"
            title="Two monies become hard to tell apart"
            visual={
              <VisualFrame caption="integration built from a million small exchanges">
                <VizYearTwenty />
              </VisualFrame>
            }
            link={{ href: "/token-economics", label: "Read the long game in full" }}
          >
            <p>
              This was never meant to happen in a season. Over decades, the two community
              currencies circulate side by side — accepted in the same shops, pooled in the same
              town projects, held by families with cousins on both sides — until merging them is
              paperwork, not a peace treaty.
            </p>
            <p>
              Integration that grows out of a million small exchanges doesn't depend on any
              government's signature, and it is very hard to bomb. That is the long game: peace
              held up not by treaties above, but by an economy the two communities built
              together, underneath.
            </p>
          </Chapter>
        </ol>
      </div>
    </section>
  )
}

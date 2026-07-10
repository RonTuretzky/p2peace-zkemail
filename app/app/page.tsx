import Link from "next/link"
import { Button } from "@/components/ui/button"
import { OliveBranchIcon } from "@/components/olive-branch-icon"
import { Story } from "@/components/home/story"

/**
 * Home = one story, told once, in order. Anything dense (calculators, feature
 * grids, deep dives) lives under /tools so this page stays a single readable
 * narrative from top to bottom.
 */
export default function HomePage() {
  return (
    <>
      {/* hero — one screen, one idea */}
      <section className="w-full py-20 md:py-28">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-accent/40 px-3 py-1 text-xs font-medium text-accent-foreground">
            <OliveBranchIcon className="h-4 w-4 text-primary" />
            p2p2p — peer to peer to peace · live on Gnosis Chain
          </div>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Make peace the profitable move
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-muted-foreground md:text-xl">
            Citizens on both sides of a conflict stake a small slice of their own money on
            de-escalation. Verified events move that money — automatically, symmetrically, under
            rules both sides approved. Identity and evidence come from something everyone already
            has: signed email.
          </p>
          <p className="mx-auto mt-4 text-sm text-muted-foreground">
            Here's the whole thing as one story, in order. Five minutes to read, forty to do for
            real.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="#story">Read the story ↓</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/verify">Skip to doing it live</Link>
            </Button>
          </div>
        </div>
      </section>

      <Story />

      {/* single closing CTA */}
      <section className="w-full border-t border-border bg-muted/30 py-16">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Now do the same story, live
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            The demo deployment compresses every waiting period to 10 minutes, so the whole
            journey — verify, mint, agree, attest, settle, claim — fits in about 40. You'll need
            a wallet and a little xDAI for gas; the tokens come from a faucet.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/verify">Start at Day 0 — verify</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/tools">Explore all the tools</Link>
            </Button>
          </div>
          <p className="mx-auto mt-6 max-w-xl text-xs text-muted-foreground">
            An experiment in mechanism design, not a promise of peace — it prices events; people
            end wars. Open source; the docs spell out honestly what it defends against and what
            it can't.
          </p>
        </div>
      </section>
    </>
  )
}

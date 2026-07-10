import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SectionChip, SectionHeading, HonestyNote, StatPill } from "@/components/explainer"

/* Governance, explained — every mechanism as a plain-language card, in the
   PRINCIPLES-grid style from the landing page. */

const MECHANISMS = [
  {
    title: "Quadratic voting — with real identities",
    body: "Casting n votes locks n² of your tokens for the voting period (returned win or lose): 1 vote costs 1 token, 3 votes cost 9, 10 votes cost 100. Caring more costs quadratically more, so a passionate minority can outweigh an indifferent majority — but nobody can simply buy the outcome. This only works because every ballot is one zkEmail-verified person: without sybil resistance, splitting tokens across ten wallets would turn n² back into n, and quadratic voting would be theater.",
  },
  {
    title: "Dual majority — neither side can impose",
    body: "Every incentive needs a separate YES majority among Community A's vote weight and among Community B's. A rule that prices one side's aggression passes only if that side voted for it too. There is no global tally to swamp: 10,000 YES votes from one community cannot overcome 51% NO in the other. The code is structurally incapable of taking sides.",
  },
  {
    title: "Participation quorum — silence doesn't legislate",
    body: "At least 30% of all registered members (both rolls combined) must cast a ballot, or the proposal fails regardless of the tallies. A quiet week where five enthusiasts vote 5–0 cannot activate a rule that moves everyone's staked money. Because the member roll is the count of verified identities — not wallets — the quorum can't be gamed by registering empty accounts.",
  },
  {
    title: "Timelock — rule changes announce themselves",
    body: "Sensitive parameters — domain allowlists, redistribution caps, dispute windows, council seats — change only through a timelocked process (48h by default). Every pending change is visible on-chain before it takes effect, so members always have time to see what's coming, object, or exit by redeeming 1:1. No parameter ambush is possible.",
  },
  {
    title: "Guardian — an emergency brake that lets go",
    body: "A leaked DKIM key could forge evidence, so someone must be able to act in minutes, not days. The guardian can revoke compromised keys instantly and pause attestation and redistribution — but never touch funds — and its pause auto-expires. It is an emergency brake with a dead-man's switch: useful in a crisis, incapable of becoming a permanent power.",
  },
  {
    title: "Daylight before settlement",
    body: "A confirmed event waits out a 48-hour public-notice window before any value moves — time for anyone to inspect it, and for the guardian to pause settlement if something looks wrong. During that window a council seated from both communities can reverse it with a 75% supermajority — high enough that neither side's members can reverse alone. Once an event finalizes it is irreversible, in both directions: no retroactive confiscations, and no retroactive pardons either.",
  },
]

const LIFECYCLE = [
  { step: "1", label: "Propose", body: "Anyone, no tokens, no fee. The trigger circuit and all parameters are frozen on-chain at submission." },
  { step: "2", label: "Discuss", body: "7 days of open discussion. The proposal itself is immutable — amendments become new proposals." },
  { step: "3", label: "Vote", body: "3 days of quadratic voting, one ballot per verified identity, tallied per community." },
  { step: "4", label: "Activate", body: "Majority in A + majority in B + 30% joint participation → the incentive goes live. Any miss → rejected, and the proposer waits 30 days." },
]

export default function GovernancePage() {
  return (
    <>
      <section className="container mx-auto px-4 py-14">
        {/* -------------------------------- hero -------------------------------- */}
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <SectionChip>Governance, explained</SectionChip>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Rules that move money need rules of their own
          </h1>
          <p className="text-muted-foreground md:text-lg">
            Every incentive in p2p2p can slash one community's staked pool when an event is proven.
            Power like that is only tolerable if it is impossible to seize — so governance is built
            from six interlocking mechanisms, each of which exists to take a specific abuse off the
            table. Here is each one, and the attack it kills.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild>
              <Link href="/incentives">Vote on live incentives</Link>
            </Button>
          </div>
        </div>

        {/* --------------------------- mechanism grid --------------------------- */}
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-2">
          {MECHANISMS.map((m) => (
            <div key={m.title} className="rounded-3xl border-2 border-border bg-card p-6">
              <h3 className="font-display text-lg font-bold">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
            </div>
          ))}
        </div>

        {/* --------------------------- quadratic cost --------------------------- */}
        <div className="mx-auto mt-20 max-w-5xl">
          <SectionHeading
            chip="Read it like this"
            title="What n² actually costs"
            lede="The tokens come back after the vote, win or lose — the cost is having them locked while you take a position. Conviction is expensive; buying the outcome is prohibitive."
          />
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            <StatPill label="1 vote" value="1 token" hint="a nudge" />
            <StatPill label="3 votes" value="9 tokens" hint="a position" />
            <StatPill label="10 votes" value="100 tokens" hint="a stand" tone="positive" />
            <StatPill label="30 votes" value="900 tokens" hint="all-in, briefly illiquid" tone="risk" />
          </div>
          <HonestyNote>
            Quadratic locking bounds influence per identity, not per faction — a coordinated group of
            many verified members still outweighs a few. That is by design: it is democracy that
            money can't shortcut, not the absence of politics.
          </HonestyNote>
        </div>

        {/* ------------------------- lifecycle of a rule ------------------------- */}
        <div className="mx-auto mt-20 max-w-5xl">
          <SectionHeading
            chip="The lifecycle of a rule"
            title="From idea to live incentive"
            lede="Four gates, in order. Nothing skips a gate, and nothing passes quietly."
          />
          <div className="mx-auto mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LIFECYCLE.map((s) => (
              <div key={s.step} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                  {s.step}
                </div>
                <h3 className="mt-3 font-display text-base font-bold">{s.label}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
          <HonestyNote>
            The periods above are the protocol defaults (7-day discussion, 3-day vote, 48-hour
            dispute). This demo deployment compresses all of them to 10 minutes so you can walk the
            whole loop in an afternoon — the pages read the live values from chain, so what you see
            on <Link href="/incentives" className="underline underline-offset-4">/incentives</Link> is
            always the truth.
          </HonestyNote>
        </div>


        {/* ------------------------------- delegation ------------------------------- */}
        <div className="mx-auto mt-16 max-w-3xl rounded-3xl border-2 border-border bg-card p-6">
          <h3 className="font-display text-lg font-bold">For people who don&apos;t want to vote on everything</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The original design also called for <span className="font-medium text-foreground">delegation</span> —
            letting a member hand their voice on day-to-day rules to someone they trust (a
            neighbor, a union, a community group) while keeping the right to take it back at any
            time. It isn&apos;t in the deployed rules yet: delegation interacts with
            one-person-one-ballot in subtle ways (a delegate&apos;s louder voice must still cost
            more), and we would rather ship it carefully than quickly. It is next on the
            governance roadmap, and this note is here so the gap is visible, not hidden.
          </p>
        </div>

        {/* --------------------------------- CTA --------------------------------- */}
        <div className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-4 rounded-3xl border-2 border-primary/40 bg-card p-8 text-center">
          <h2 className="font-display text-2xl font-bold">See governance running, not described</h2>
          <p className="text-sm text-muted-foreground">
            Every mechanism on this page is live on Gnosis right now: propose and vote at
            /incentives, and watch events settle in daylight at /pouncil.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/incentives">Propose &amp; vote — /incentives</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

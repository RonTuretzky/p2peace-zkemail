import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SectionChip, SectionHeading, HonestyNote } from "@/components/explainer"

/* Sanctions relief, explained — the tokenized-sanctions thesis, the tranche
   lifecycle, and the anti-imperialist framing kept honest. */

const LIFECYCLE = [
  {
    step: "1",
    title: "Deposit — the promise is made precise",
    body: "A donor — a state, an NGO, a diaspora network — deposits reserve assets into the SanctionsEscrow as a tranche. At deposit time three things are fixed forever: which approved incentive must fire (say, the checkpoint-removal incentive), who benefits (pool A, pool B, both, or the Treasury), and an expiry date. From that moment the money is on the table, visible to everyone, and the donor cannot move the goalposts.",
  },
  {
    step: "2",
    title: "Watch — the same pipeline as everything else",
    body: "There is no special committee judging whether 'progress' happened. The release condition is exactly the protocol's own event pipeline: newsletter attestations from both sides' press plus international wires, distinct-source thresholds, confirmation, the 48-hour dispute window, finalization. If the referenced incentive never fires, the tranche just sits there — patient, public, and earning nothing but credibility.",
  },
  {
    step: "3",
    title: "Release or reclaim — no third outcome",
    body: "The moment a finalized event of the referenced incentive exists, anyone can trigger release — the tranche pays out to the chosen beneficiary at par, claimable as the usual equal-per-member dividend. If the expiry passes with no finalized event, the donor reclaims the full deposit. Those are the only two exits; there is no discretionary 'circumstances have changed' clause.",
  },
]

const HONEST_FRAMING = [
  {
    title: "What external money can buy",
    body: "Outcomes. A donor can say 'when the checkpoint verifiably comes down, this fund pays the communities' — and be believed, because the code makes the promise self-executing. That is a genuinely new kind of foreign engagement: conditional, transparent, and impossible to quietly renege on.",
  },
  {
    title: "What external money cannot buy",
    body: "Power. Depositing into the escrow grants no votes, no council seats, no parameter access, no veto. Which incentives exist — and therefore which outcomes can even be funded — is decided solely by dual-majority votes of the two communities. Donors fund the menu; they never write it.",
  },
  {
    title: "Why the conditions are immutable",
    body: "Traditional sanctions relief is a moving target: conditions shift with elections, hidden criteria appear, promised relief evaporates after compliance. Freezing incentive, beneficiary, and expiry at deposit time removes the discretion that makes sanctions an instrument of leverage rather than of outcomes. If the event happens, payment happens — even if the donor's government changed its mind in the meantime.",
  },
  {
    title: "What this doesn't fix",
    body: "A tranche in this contract moves escrowed crypto — it does not lift a real-world tariff, unfreeze a bank account, or reopen a border. The thesis is that credible, self-executing commitments are the missing primitive that real sanctions policy could be rebuilt on; this contract is that primitive working at demo scale, not a claim that geopolitics is now a smart contract.",
  },
]

export default function ExternalIncentivesPage() {
  return (
    <>
      <section className="container mx-auto px-4 py-14">
        {/* -------------------------------- hero -------------------------------- */}
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <SectionChip>Sanctions relief, explained</SectionChip>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Turning sanctions from a stick into an escrow
          </h1>
          <p className="text-muted-foreground md:text-lg">
            Sanctions are conditional money with the conditions kept vague — relief is promised for
            'progress', judged later, by the sanctioning power, in private. The original p2p2p
            concept proposed tokenizing that promise instead: outside parties lock funds against a
            specific, community-approved incentive, and cryptographic evidence — not diplomacy —
            decides whether the money releases. One contract, three states, zero discretion.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild>
              <Link href="/escrow">Open the escrow — /escrow</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/incentives">See fundable incentives</Link>
            </Button>
          </div>
        </div>

        {/* ------------------------------ lifecycle ------------------------------ */}
        <div className="mx-auto mt-16 max-w-5xl">
          <SectionHeading
            chip="The tranche lifecycle"
            title="Deposit → watch → release or reclaim"
            lede="Every tranche lives this exact life. Nothing about it can be renegotiated after the deposit confirms."
          />
          <div className="mx-auto mt-10 grid gap-6 lg:grid-cols-3">
            {LIFECYCLE.map((s) => (
              <div key={s.step} className="rounded-3xl border-2 border-border bg-card p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-base font-bold text-primary-foreground">
                  {s.step}
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
          <HonestyNote>
            Release is one-shot and irreversible, and reclaim is only possible after expiry with no
            finalized event — a donor can never yank funds back mid-window because the news started
            looking likely. The clock protects both sides of the promise.
          </HonestyNote>
        </div>

        {/* --------------------------- honest framing --------------------------- */}
        <div className="mx-auto mt-20 max-w-5xl">
          <SectionHeading
            chip="Power dynamics, kept honest"
            title="Anti-imperialist by construction — with the fine print attached"
            lede="The concept's promise was that external funding could stop being a lever of control. Here is exactly how far the code delivers on that, and where it stops."
          />
          <div className="mx-auto mt-10 grid gap-6 sm:grid-cols-2">
            {HONEST_FRAMING.map((f) => (
              <div key={f.title} className="rounded-3xl border-2 border-border bg-card p-6">
                <h3 className="font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* --------------------------------- CTA --------------------------------- */}
        <div className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-4 rounded-3xl border-2 border-primary/40 bg-card p-8 text-center">
          <h2 className="font-display text-2xl font-bold">Fund an outcome</h2>
          <p className="text-sm text-muted-foreground">
            The escrow is live on Gnosis: deposit a tranche against any passed incentive, watch it
            release when the event finalizes — or reclaim it after expiry. In this demo, expiries
            can be set minutes out so you can see both endings.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/escrow">Deposit a tranche — /escrow</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/economic-incentives">How incentives work</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

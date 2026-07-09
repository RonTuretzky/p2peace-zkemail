import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SectionChip, SectionHeading, HonestyNote, StatPill } from "@/components/explainer"

/* Token economics, explained — the reserve invariant, the 90/10 split, the
   outsider premium, and what the pools can and cannot touch, each in plain
   language with a static "read it like this" visualization. */

const POOL_RULES = [
  {
    can: true,
    title: "The staked corpus can be slashed",
    body: "The 10% peace stake from every citizen mint sits in your community's pool corpus. A finalized harmful event by your side moves a capped slice of it (≤5% of the corpus per event) to the other side's pool. That exposure is the point — it's the money you put where your community's behavior is.",
  },
  {
    can: true,
    title: "The pool can receive and pay dividends",
    body: "Pool-to-pool transfers, Treasury rewards for positive events, and released escrow tranches all land in a pool's reward balance — which members claim in equal per-person shares.",
  },
  {
    can: false,
    title: "Your wallet balance is untouchable",
    body: "The 90% in your wallet is never slashable, never freezable, never votable-away. No incentive, no council decision, no governance vote can reach it. If you don't like where things are heading, redeem 1:1 and walk.",
  },
  {
    can: false,
    title: "The other side's savings are untouchable too",
    body: "Rewards for one side's de-escalation are paid by the shared Treasury — never taken from the other community's pool or wallets. Rewarding peace never manufactures a new grievance.",
  },
]

function Bar({ segments }: { segments: { pct: number; label: string; cls: string }[] }) {
  return (
    <div className="flex h-14 w-full overflow-hidden rounded-xl text-xs font-bold">
      {segments.map((s) => (
        <div
          key={s.label}
          style={{ width: `${s.pct}%` }}
          className={`flex items-center justify-center px-1 text-center leading-tight ${s.cls}`}
        >
          {s.label}
        </div>
      ))}
    </div>
  )
}

export default function TokenEconomicsPage() {
  return (
    <>
      <section className="container mx-auto px-4 py-14">
        {/* -------------------------------- hero -------------------------------- */}
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <SectionChip>Token economics, explained</SectionChip>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            The token is a receipt, not a bet
          </h1>
          <p className="text-muted-foreground md:text-lg">
            PEACE-A and PEACE-B don't float, don't inflate, and don't promise number-go-up. Every
            token is minted 1:1 against a reserve deposit and redeems 1:1, any time. All the
            economics live in two deliberate asymmetries: the 10% peace stake citizens opt into, and
            the 2× premium outsiders pay. Here is exactly where every unit goes.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild>
              <Link href="/mint">Mint tokens</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/pools">See the pools</Link>
            </Button>
          </div>
        </div>

        {/* --------------------------- reserve invariant --------------------------- */}
        <div className="mx-auto mt-16 max-w-5xl">
          <SectionHeading
            chip="The one invariant"
            title="Reserve equals supply, always"
            lede="For every token in existence there is exactly one unit of reserve asset in the contract backing it. Minting deposits reserve and creates tokens; redeeming burns tokens and returns reserve. There is no seigniorage, no fractional trick, no depeg mechanics."
          />
          <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
            <StatPill label="Mint rate" value="1 : 1" hint="1 reserve in → 1 token out" />
            <StatPill label="Redeem rate" value="1 : 1" hint="any holder, any time, no queue" />
            <StatPill label="Backing" value="100%" hint="reserve balance == token supply" tone="positive" />
          </div>
          <HonestyNote>
            Read it like this: holding the token can never lose you money to protocol mechanics —
            only the 10% you explicitly staked is ever at risk, and only under rules your own
            community voted for. Even redistribution preserves the invariant: slashed pool tokens
            are redeemed to reserve and re-minted at par on the receiving side.
          </HonestyNote>
        </div>

        {/* ----------------------------- the two mints ----------------------------- */}
        <div className="mx-auto mt-20 max-w-5xl">
          <SectionHeading
            chip="Follow the money"
            title="Two ways in, two very different splits"
            lede="The same 100 mUSD deposit does different work depending on who you are. Citizens get full value with a peace stake; outsiders get half value and half solidarity."
          />

          <div className="mx-auto mt-10 grid gap-6 lg:grid-cols-2">
            {/* Citizen mint */}
            <div className="rounded-3xl border-2 border-border bg-card p-6">
              <h3 className="font-display text-lg font-bold">A verified citizen mints 100 mUSD</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                100 tokens are minted — full value, because identity was proven. 90 go to your
                wallet; 10 are staked into your community's pool corpus. That stake is your
                signature on the rebalancing agreement: minting <em>is</em> consenting.
              </p>
              <div className="mt-5">
                <Bar
                  segments={[
                    { pct: 90, label: "90 tokens → your wallet (redeemable 1:1, untouchable)", cls: "bg-accent/70 text-accent-foreground" },
                    { pct: 10, label: "10 staked", cls: "bg-primary text-primary-foreground" },
                  ]}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Read it like this: for every 100 you put in, 90 are ordinary money and 10 are your
                  personal stake on your own side keeping the peace.
                </p>
              </div>
            </div>

            {/* Outsider mint */}
            <div className="rounded-3xl border-2 border-border bg-card p-6">
              <h3 className="font-display text-lg font-bold">An outsider mints 100 mUSD</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                No identity proof, so the rate is 2× par: 50 tokens are minted 1:1 against half the
                payment, and the other 50 mUSD goes to the shared Treasury — the fund that pays
                every positive-event reward and cooperation bonus. Money in, no governance power:
                outsiders hold, pay, and redeem, but never vote.
              </p>
              <div className="mt-5">
                <Bar
                  segments={[
                    { pct: 50, label: "50 tokens → your wallet (backed 1:1)", cls: "bg-accent/70 text-accent-foreground" },
                    { pct: 50, label: "50 mUSD → Treasury", cls: "bg-primary text-primary-foreground" },
                  ]}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Read it like this: an outsider mint is half purchase, half donation to the peace
                  fund — solidarity with a receipt, and no capture vector.
                </p>
              </div>
            </div>
          </div>
          <HonestyNote>
            Numbers are the demo defaults (10% stake, 2× outsider premium) read from the deployed
            PeaceMinter contracts; a production deployment would set its own via governance. mUSD is
            the demo's mock reserve asset — grab some from the faucet on the mint page.
          </HonestyNote>
        </div>

        {/* --------------------------- what pools can touch --------------------------- */}
        <div className="mx-auto mt-20 max-w-5xl">
          <SectionHeading
            chip="Boundaries"
            title="What the pools can and cannot touch"
            lede="Redistribution sounds scary until you see its fence. Two things are exposed; two things are structurally out of reach."
          />
          <div className="mx-auto mt-10 grid gap-6 sm:grid-cols-2">
            {POOL_RULES.map((r) => (
              <div
                key={r.title}
                className={`rounded-3xl border-2 p-6 ${r.can ? "border-border bg-card" : "border-primary/40 bg-accent/20"}`}
              >
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    r.can ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-primary/15 text-primary"
                  }`}
                >
                  {r.can ? "Exposed — by consent" : "Never touchable"}
                </span>
                <h3 className="mt-3 font-display text-lg font-bold">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ------------------------ dividends & cooperation ------------------------ */}
        <div className="mx-auto mt-20 max-w-5xl">
          <SectionHeading
            chip="Where value lands"
            title="Equal dividends and subsidized cooperation"
            lede="Everything that flows into a pool leaves it the same way: one equal share per verified person."
          />
          <div className="mx-auto mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border-2 border-border bg-card p-6">
              <h3 className="font-display text-lg font-bold">The per-citizen peace dividend</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Pool payouts raise a reward-per-member accumulator, and every verified member claims
                the identical amount — whether they staked 10 tokens or 10,000. A payout of 5,000
                tokens to a pool with 1,000 members is exactly 5 tokens each. Peace revenue is a
                dividend of citizenship, not a return on capital, and claims follow your identity
                even if you rotate wallets.
              </p>
            </div>
            <div className="rounded-3xl border-2 border-border bg-card p-6">
              <h3 className="font-display text-lg font-bold">The cooperation bonus, budget-capped</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Pay a certified business across the community line and the Treasury adds a 2% bonus
                on top — commerce across the divide is subsidized, not taxed. To keep enthusiasm
                from draining the fund, each epoch snapshots a budget of 1% of the Treasury; once an
                epoch's budget is spent, payments still clear but bonuses pause until the next epoch
                rolls. Try it live at{" "}
                <Link href="/business" className="font-medium text-primary underline underline-offset-4">
                  /business
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* --------------------------------- CTA --------------------------------- */}
        <div className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-4 rounded-3xl border-2 border-primary/40 bg-card p-8 text-center">
          <h2 className="font-display text-2xl font-bold">Watch the splits happen on-chain</h2>
          <p className="text-sm text-muted-foreground">
            Mint with the faucet and see the 90/10 split land in real balances, then watch both
            pools' corpus and claimable dividends move as events settle.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/mint">Mint tokens — /mint</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pools">The peace pools — /pools</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

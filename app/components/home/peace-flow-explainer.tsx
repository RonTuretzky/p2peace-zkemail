"use client"

import {
  EnvelopeSimple,
  Coins,
  Handshake,
  Newspaper,
  Hourglass,
  HandCoins,
} from "@phosphor-icons/react"
import { SectionHeading, StepperExplainer, HonestyNote, type ExplainerStep } from "@/components/explainer"
import { cn } from "@/lib/utils"

/**
 * PeaceFlowExplainer
 * ------------------
 * The mechanism, crowdstake-style: a persistent diagram of both communities'
 * peace pools, the newsletter-evidence pipeline between them, and the shared
 * treasury below — each step lights up the part it explains.
 */

const STEPS: ExplainerStep[] = [
  {
    key: "verify",
    short: "Verify",
    title: "One inbox, one voice",
    body: "Your government already emails you — tax receipts, ID-portal notices — and every one of those emails is cryptographically signed (DKIM). You prove you receive them, in zero knowledge, straight from a saved email. No documents uploaded, no server involved, and your address never appears on-chain: just a nullifier that ties one inbox to one membership.",
    chip: "Your email address never goes on-chain",
    icon: EnvelopeSimple,
  },
  {
    key: "mint",
    short: "Mint",
    title: "Mint 1:1 — 90% yours, 10% staked for peace",
    body: "Verified citizens mint their community's token one-for-one against the reserve: every token is backed and redeemable, always. 90% goes to your wallet. The other 10% is your peace stake — it joins your community's pool, the only capital the protocol can ever move. Minting is signing the deal.",
    chip: "Unstaked savings are untouchable",
    icon: Coins,
  },
  {
    key: "agree",
    short: "Agree",
    title: "Both communities write the rules — together",
    body: "Anyone can propose an incentive: “if checkpoint removals in the Jordan Valley are reported by both sides' press plus international wires, reward it.” The keyword logic is committed as the hash of an exact circuit — voters approve a machine, not prose. It only activates with a separate YES-majority in each community, voting quadratically, one identity one ballot.",
    chip: "Neither side can impose rules on the other",
    icon: Handshake,
  },
  {
    key: "attest",
    short: "Attest",
    title: "Newsletters are the oracle",
    body: "News organizations DKIM-sign every newsletter they send. When something happens, any subscriber on earth holds durable, provable evidence in their inbox. Attesters submit zero-knowledge proofs that their email matches the incentive's committed keywords; an event only confirms with distinct sources from community A, community B, and international press.",
    chip: "No notary, no monitoring service, nothing to censor",
    icon: Newspaper,
  },
  {
    key: "settle",
    short: "Settle",
    title: "48 hours of daylight, then value moves",
    body: "A confirmed event doesn't touch a cent for 48 hours. That's the dispute window: a council seated from both communities can reverse a bogus event with a 75% supermajority. Only after the window closes does the engine move value — a capped slice of the responsible side's pool corpus, redeemed and re-minted at par into the other side's rewards.",
    chip: "Capped at 5% of the pool per event",
    icon: Hourglass,
  },
  {
    key: "claim",
    short: "Claim",
    title: "An equal peace dividend",
    body: "Pool rewards pay out identically per verified member — not by wealth. A harmed community's members each claim the same share; positive actions and joint projects are rewarded from the shared Treasury (funded by outsider premiums and donations), so rewarding de-escalation never punishes anyone. Claims are yours to redeem 1:1, any time.",
    chip: "Per-citizen, not per-token",
    icon: HandCoins,
  },
]

/* ------------------------------- the diagram ------------------------------- */

function Pool({
  side,
  active,
  slashed,
  rewarded,
}: {
  side: "A" | "B"
  active: boolean
  slashed?: boolean
  rewarded?: boolean
}) {
  return (
    <div
      className={cn(
        "flex-1 rounded-2xl border-2 p-3 transition-all duration-500",
        active ? "border-primary shadow-lg" : "border-border opacity-80",
      )}
    >
      <div className="text-xs font-semibold text-muted-foreground">Peace pool {side}</div>
      <div className="mt-2 space-y-1">
        <div
          className={cn(
            "rounded-lg px-2 py-2 text-xs font-medium transition-all duration-500",
            slashed ? "bg-amber-500/30 text-amber-900 dark:text-amber-200" : "bg-primary/20 text-foreground",
          )}
        >
          corpus — staked, at risk <span className="opacity-60">by consent</span>
        </div>
        <div
          className={cn(
            "rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-500",
            rewarded
              ? "bg-primary text-primary-foreground py-3"
              : "bg-accent/60 text-accent-foreground",
          )}
        >
          rewards — equal-per-member dividend
        </div>
      </div>
    </div>
  )
}

function Diagram({ step }: { step: string }) {
  const hl = (keys: string[]) => keys.includes(step)
  return (
    <div className="bg-gradient-to-b from-accent/20 to-transparent p-5 sm:p-8">
      {/* top row: citizen → pools ← citizen */}
      <div className="flex items-stretch gap-3">
        {/* citizen A */}
        <div
          className={cn(
            "flex w-24 flex-none flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center transition-all duration-500 sm:w-32",
            hl(["verify", "mint"]) ? "border-primary shadow-lg" : "border-border opacity-80",
          )}
        >
          <EnvelopeSimple size={22} weight="bold" className="text-primary" />
          <span className="text-[11px] font-semibold leading-tight">citizen A</span>
          <span className="text-[10px] leading-tight text-muted-foreground">
            {step === "verify" ? "gov email → ZK proof" : "verified member"}
          </span>
        </div>

        {/* mint split arrow */}
        <div className="hidden w-16 flex-none flex-col items-center justify-center text-[10px] text-muted-foreground sm:flex">
          <span className={cn("transition-opacity", hl(["mint"]) ? "opacity-100 font-semibold text-foreground" : "opacity-50")}>
            90% wallet
          </span>
          <span aria-hidden className="text-lg leading-none text-primary">⇢</span>
          <span className={cn("transition-opacity", hl(["mint"]) ? "opacity-100 font-semibold text-foreground" : "opacity-50")}>
            10% stake
          </span>
        </div>

        <Pool side="A" active={hl(["mint", "settle", "claim"])} slashed={step === "settle"} />

        {/* the pipeline between pools */}
        <div className="flex w-28 flex-none flex-col items-center justify-center gap-1 sm:w-40">
          <div
            className={cn(
              "w-full rounded-xl border-2 p-2 text-center transition-all duration-500",
              hl(["agree"]) ? "border-primary shadow-lg" : "border-border opacity-70",
            )}
          >
            <Handshake size={18} weight="bold" className="mx-auto text-primary" />
            <div className="text-[10px] font-semibold leading-tight">incentive rules</div>
            <div className="text-[9px] text-muted-foreground">dual majority · exact circuit</div>
          </div>
          <div
            className={cn(
              "w-full rounded-xl border-2 p-2 text-center transition-all duration-500",
              hl(["attest"]) ? "border-primary shadow-lg" : "border-border opacity-70",
            )}
          >
            <Newspaper size={18} weight="bold" className="mx-auto text-primary" />
            <div className="text-[10px] font-semibold leading-tight">newsletter proofs</div>
            <div className="mt-1 flex justify-center gap-0.5">
              {["A", "B", "int", "int"].map((s, i) => (
                <span
                  key={i}
                  className={cn(
                    "rounded px-1 text-[8px] font-bold transition-colors duration-500",
                    hl(["attest"])
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div
            className={cn(
              "flex w-full items-center justify-center gap-1 rounded-xl border-2 p-1.5 transition-all duration-500",
              hl(["settle"]) ? "border-primary shadow-lg" : "border-border opacity-70",
            )}
          >
            <Hourglass size={14} weight="bold" className="text-primary" />
            <span className="text-[10px] font-semibold">48h dispute</span>
          </div>
          <span
            aria-hidden
            className={cn(
              "text-xl leading-none text-primary transition-opacity duration-500",
              hl(["settle", "claim"]) ? "opacity-100" : "opacity-30",
            )}
          >
            ⇉
          </span>
        </div>

        <Pool side="B" active={hl(["settle", "claim"])} rewarded={hl(["settle", "claim"])} />

        {/* citizen B */}
        <div
          className={cn(
            "flex w-24 flex-none flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center transition-all duration-500 sm:w-32",
            hl(["verify", "claim"]) ? "border-primary shadow-lg" : "border-border opacity-80",
          )}
        >
          <HandCoins size={22} weight="bold" className="text-primary" />
          <span className="text-[11px] font-semibold leading-tight">citizen B</span>
          <span className="text-[10px] leading-tight text-muted-foreground">
            {step === "claim" ? "claims equal share" : "verified member"}
          </span>
        </div>
      </div>

      {/* treasury row */}
      <div className="mx-auto mt-4 max-w-md">
        <div
          className={cn(
            "rounded-2xl border-2 p-2 text-center transition-all duration-500",
            hl(["claim"]) ? "border-primary shadow-lg" : "border-border opacity-70",
          )}
        >
          <div className="text-[11px] font-semibold">
            Shared Treasury{" "}
            <span className="font-normal text-muted-foreground">
              — outsider premiums + donations + escrowed sanctions relief
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            pays rewards for positive & joint actions, and cross-community commerce bonuses
          </div>
        </div>
      </div>
    </div>
  )
}

export function PeaceFlowExplainer() {
  return (
    <section id="mechanism" className="w-full border-t border-border py-20">
      <div className="container mx-auto px-4">
        <SectionHeading
          chip="How the mechanism works"
          title="Where the peace dividend comes from"
          lede="Only capital that was staked on purpose ever moves — and it moves on evidence both sides agreed to in advance. Here's the whole trip, from an email in your inbox to a dividend in your neighbor's wallet."
        />
        <StepperExplainer steps={STEPS} diagram={(k) => <Diagram step={k} />} />
        <HonestyNote>
          Numbers shown reflect the live demo deployment (5% max slice per event, 10% mint
          stake, 10-minute demo windows). Every parameter is governed by the dual-majority
          vote — nothing here is hard-coded doctrine.
        </HonestyNote>
      </div>
    </section>
  )
}

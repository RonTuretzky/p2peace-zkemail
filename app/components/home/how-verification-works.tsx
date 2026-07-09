"use client"

import { Signature, FileMagnifyingGlass, ListChecks, Scales } from "@phosphor-icons/react"
import { SectionHeading, StepperExplainer, HonestyNote, type ExplainerStep } from "@/components/explainer"
import { cn } from "@/lib/utils"

/**
 * HowVerificationWorks
 * --------------------
 * The trust deep-dive: what a DKIM signature is, why any subscriber can be the
 * oracle, what a zero-knowledge proof reveals (and hides), and what has to line
 * up before a single token moves.
 */

const STEPS: ExplainerStep[] = [
  {
    key: "sign",
    short: "Signed",
    title: "Every email is already signed — by the sender's own servers",
    body: "When Reuters sends its breaking-news email, its mail server signs the message with a private key (DKIM — the standard that runs the entire email ecosystem). The matching public key sits in Reuters' DNS for anyone to check. That signature freezes the exact words, the sender, and the send time. Nobody — not the reader, not the protocol, not a state — can alter the email afterwards without breaking the signature.",
    chip: "DKIM: the web's oldest working PKI",
    icon: Signature,
  },
  {
    key: "prove",
    short: "Proven",
    title: "Any subscriber proves it — without showing the email",
    body: "Whoever received that email holds durable evidence. A zero-knowledge circuit runs in their browser and proves three things: the signature verifies against the archived key, the sender is one of the incentive's approved outlets, and the body matches the exact keyword pattern both communities voted on. What comes out is a proof plus a nullifier — the email itself, and the reader's identity, never leave their machine.",
    chip: "Reveals the fact, hides the reader",
    icon: FileMagnifyingGlass,
  },
  {
    key: "tally",
    short: "Tallied",
    title: "One outlet is never enough",
    body: "An event only confirms when distinct sources agree across the divide: at least one community-A outlet, at least one community-B outlet, and two international wires — all within the same reporting window, each counted once (per-email nullifiers stop double-counting; per-outlet slots stop one newsroom from filling the tally alone). A captured or compromised outlet cannot fire an event by itself.",
    chip: "≥1 A · ≥1 B · ≥2 international",
    icon: ListChecks,
  },
  {
    key: "judge",
    short: "Judged",
    title: "Then humans get 48 hours",
    body: "Confirmation opens a dispute window — nothing moves yet. A council seated from both communities can reverse a manipulated event with a 75% supermajority; the DKIM registry's guardian can kill a leaked signing key instantly. Only when the window closes untouched does the engine execute. Cryptography narrows what needs judging; it doesn't replace the judges.",
    chip: "Machines verify, communities decide",
    icon: Scales,
  },
]

function Diagram({ step }: { step: string }) {
  const on = (k: string) => step === k
  const box = (active: boolean) =>
    cn(
      "rounded-2xl border-2 p-3 text-center transition-all duration-500",
      active ? "border-primary shadow-lg" : "border-border opacity-70",
    )
  return (
    <div className="bg-gradient-to-b from-accent/20 to-transparent p-5 sm:p-8">
      <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        <div className={box(on("sign"))}>
          <div className="text-2xl">📰</div>
          <div className="text-xs font-semibold">newsletter</div>
          <div className="text-[10px] text-muted-foreground">
            DKIM-signed at send time{on("sign") && " — words, sender, date frozen"}
          </div>
        </div>
        <Arrow active={on("prove")} />
        <div className={box(on("prove"))}>
          <div className="text-2xl">🔏</div>
          <div className="text-xs font-semibold">ZK proof in your browser</div>
          <div className="text-[10px] text-muted-foreground">
            signature ✓ · outlet ✓ · keywords ✓ — email stays private
          </div>
        </div>
        <Arrow active={on("tally")} />
        <div className={box(on("tally"))}>
          <div className="mb-1 flex justify-center gap-1">
            {[
              { l: "A", need: 1 },
              { l: "B", need: 1 },
              { l: "Intl", need: 2 },
            ].map((c) => (
              <span
                key={c.l}
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-bold transition-colors duration-500",
                  on("tally") ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {c.l} ×{c.need}
              </span>
            ))}
          </div>
          <div className="text-xs font-semibold">distinct-source tally</div>
          <div className="text-[10px] text-muted-foreground">both sides + world press</div>
        </div>
        <Arrow active={on("judge")} />
        <div className={box(on("judge"))}>
          <div className="text-2xl">⚖️</div>
          <div className="text-xs font-semibold">48h dispute window</div>
          <div className="text-[10px] text-muted-foreground">
            75% council reversal · guardian key-kill · then, and only then, value moves
          </div>
        </div>
      </div>
    </div>
  )
}

function Arrow({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "hidden text-center text-xl text-primary transition-opacity duration-500 sm:block",
        active ? "opacity-100" : "opacity-30",
      )}
    >
      →
    </span>
  )
}

export function HowVerificationWorks() {
  return (
    <section id="verification" className="w-full border-t border-border bg-muted/30 py-20">
      <div className="container mx-auto px-4">
        <SectionHeading
          chip="The trust layer"
          title="How events are actually verified"
          lede="The original design needed a monitoring service watching news sites through a notary — one choke point to censor, bribe, or DDoS. zkEmail deletes that box: the evidence is already sitting, signed, in millions of inboxes."
        />
        <StepperExplainer steps={STEPS} diagram={(k) => <Diagram step={k} />} />
        <HonestyNote>
          Honest limits: newsletters carry headline-grade language, so keyword patterns target
          how wires actually write; DKIM keys rotate, so the protocol archives them on-chain and
          can revoke a compromised key instantly; and citizenship proofs bind one inbox — not
          one human — per membership. The full threat model ships in the repo, attacks and all.
        </HonestyNote>
      </div>
    </section>
  )
}

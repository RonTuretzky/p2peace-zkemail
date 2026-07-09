"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Mail, Cpu, Send, CheckCircle, Upload, RotateCcw, ShieldCheck } from "lucide-react"

const STEPS = [
  { title: "Upload .eml", icon: Upload, description: "Load the DKIM-signed newsletter from your inbox" },
  { title: "Prove locally", icon: Cpu, description: "The zkEmail circuit runs in your browser (WASM)" },
  { title: "Submit proof", icon: Send, description: "EmailProof goes to the EventAttestation contract" },
  { title: "Tallied", icon: CheckCircle, description: "Your source counts toward the event thresholds" },
]

const DEMO_PROOF = [
  {
    field: "dkimPubkeyHash",
    value: "0x1f8a…c4e2",
    note: "Poseidon hash of the RSA key that signed the email — checked against the on-chain DKIMRegistry",
  },
  {
    field: "domainHash",
    value: "keccak256(“newsletters.reuters.com”)",
    note: "The sender domain, matched against the incentive's approved source set (tagged International)",
  },
  {
    field: "nullifier",
    value: "Poseidon(dkimSignature)",
    note: "Unique per physical email — this newsletter can never be attested twice",
  },
  {
    field: "patternHash",
    value: "0x7d31…09af",
    note: "Commitment to the compiled keyword circuit the body matched — must equal the incentive's committed pattern",
  },
  {
    field: "emailTimestamp",
    value: "1791571200 (Date header)",
    note: "DKIM-covered send time — must fall inside the 7-day event window",
  },
  {
    field: "proof[8]",
    value: "Groth16 πA, πB, πC",
    note: "The zero-knowledge proof itself; extraData is 0 for attestations (it binds a wallet only for identity proofs)",
  },
]

export default function AttestPage() {
  const [step, setStep] = useState(0)

  const advance = () => setStep((s) => Math.min(s + 1, STEPS.length))
  const reset = () => setStep(0)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container flex h-16 items-center justify-between py-4">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Attest an Event</h1>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Got the newsletter? You are the oracle. Any subscriber can prove a DKIM-signed news email matches
                  an active incentive — right from their inbox, with nothing sensitive leaving their device.
                </p>
              </div>
            </div>

            <div className="mx-auto max-w-5xl mt-12 space-y-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    <CardTitle>Interactive Walkthrough (Demo)</CardTitle>
                  </div>
                  <CardDescription>
                    A static simulation of the attestation flow — no wallet or real email needed. In production this
                    page runs the zk-email SDK prover in your browser.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {STEPS.map((s, i) => {
                      const Icon = s.icon
                      const state = i < step ? "done" : i === step ? "active" : "todo"
                      return (
                        <div
                          key={s.title}
                          className={`p-4 rounded-lg border flex flex-col items-center text-center gap-2 ${
                            state === "done"
                              ? "bg-primary/10 border-primary/40"
                              : state === "active"
                                ? "bg-muted border-primary"
                                : "bg-muted/40 border-transparent"
                          }`}
                        >
                          <div className={`p-3 rounded-full ${state === "todo" ? "bg-muted" : "bg-primary/10"}`}>
                            <Icon className={`h-6 w-6 ${state === "todo" ? "text-muted-foreground" : "text-primary"}`} />
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={state === "done" ? "default" : "outline"}>{i + 1}</Badge>
                            <h4 className="font-medium text-sm">{s.title}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                        </div>
                      )
                    })}
                  </div>

                  <div className="bg-muted p-4 rounded-lg min-h-[96px]">
                    {step === 0 && (
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p className="font-medium text-foreground">Step 1 — Upload the newsletter .eml</p>
                        <p>
                          Download the raw email (with headers) from your mail client. It must be directly received —
                          forwarding breaks DKIM alignment for the original sender. The demo pretends you uploaded a
                          Reuters breaking-news alert reporting a checkpoint removal in the Jordan Valley, matching
                          incentive #42.
                        </p>
                      </div>
                    )}
                    {step === 1 && (
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p className="font-medium text-foreground">Step 2 — Prove locally</p>
                        <p>
                          The prover loads the news-event blueprint pinned by incentive #42&apos;s patternHash, verifies
                          the DKIM RSA signature in-circuit, checks the compiled keyword regexes against the signed
                          body, and derives the nullifier from the DKIM signature. Takes ~10–60 seconds of WASM
                          computation; the email itself never leaves this tab.
                        </p>
                      </div>
                    )}
                    {step === 2 && (
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p className="font-medium text-foreground">Step 3 — Submit the EmailProof</p>
                        <p>
                          The six public signals plus the Groth16 proof are submitted as
                          <code className="mx-1 text-xs bg-background px-1 py-0.5 rounded">attest(incentiveId, EmailProof)</code>
                          to the EventAttestation contract — by you or any relayer, since the proof reveals nothing
                          sensitive and cannot be altered.
                        </p>
                      </div>
                    )}
                    {step >= 3 && (
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p className="font-medium text-foreground">
                          {step === 3 ? "Step 4 — Tallied" : "Done — attestation counted"}
                        </p>
                        <p>
                          The contract verified the proof, confirmed newsletters.reuters.com is in the approved source
                          set, consumed the nullifier, and counted one distinct International source for this event
                          window. When thresholds are met (≥1 community-A source, ≥1 community-B source, ≥2
                          international within 7 days) the event becomes CONFIRMED and the 48-hour dispute window
                          opens before any funds move.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 justify-center">
                    {step < STEPS.length ? (
                      <Button onClick={advance}>
                        {step === 0 && "Upload sample .eml"}
                        {step === 1 && "Generate proof"}
                        {step === 2 && "Submit to EventAttestation"}
                        {step === 3 && "Finish"}
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={reset}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Restart demo
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <CardTitle>What Goes On-Chain: the EmailProof</CardTitle>
                  </div>
                  <CardDescription>
                    Both proof types (citizenship and news-event) share this exact public-signal layout, checked by
                    the ZKEmailVerifier contract
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {DEMO_PROOF.map((row) => (
                      <div key={row.field} className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-1 md:gap-4 border-b pb-3 last:border-b-0">
                        <code className="text-sm font-mono text-primary">{row.field}</code>
                        <div>
                          <p className="text-sm font-mono">{row.value}</p>
                          <p className="text-xs text-muted-foreground mt-1">{row.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-muted p-4 rounded-lg mt-6">
                    <h4 className="font-medium">Why this beats a monitoring service</h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      Under the original zkTLS design, someone had to run a notary session against each news site
                      while the article was live — a single choke point to censor, bribe, or DDoS. With zkEmail,
                      every newsletter subscriber on earth holds durable, independently provable evidence, and the
                      DKIM signature stays valid even if the article is edited or taken down.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="text-center flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="outline" asChild>
                  <Link href="/verification">How Verification Works</Link>
                </Button>
                <Button size="lg" asChild>
                  <Link href="/propose-incentive">Propose an Incentive</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="w-full border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-sm text-muted-foreground">© 2025 p2p2p Initiative. All rights reserved.</p>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="#" className="text-muted-foreground hover:underline underline-offset-4">
              Terms
            </Link>
            <Link href="#" className="text-muted-foreground hover:underline underline-offset-4">
              Privacy
            </Link>
            <Link href="#" className="text-muted-foreground hover:underline underline-offset-4">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

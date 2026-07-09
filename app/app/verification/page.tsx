import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Lock, FileCheck, UserCheck, Mail } from "lucide-react"

export default function VerificationPage() {
  return (
    <>
      <section className="container mx-auto px-4 py-14">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            zkEmail Verification System
          </h1>
          <p className="text-muted-foreground md:text-lg">
            Identities and events are proven from DKIM-signed emails with zero-knowledge proofs —
            nothing sensitive ever leaves your device.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild>
              <Link href="/verify">Get verified now</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/attest">Attest an event</Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-3xl rounded-lg border border-primary/30 bg-accent/40 p-4 text-center text-sm text-accent-foreground">
          This is a conceptual explainer — try the live flow at{" "}
          <Link href="/verify" className="font-medium underline underline-offset-4">
            /verify
          </Link>{" "}
          (or{" "}
          <Link href="/incentives" className="font-medium underline underline-offset-4">
            /incentives
          </Link>
          ).
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:gap-12 mt-12">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary" />
                    <CardTitle>Identity Verification</CardTitle>
                  </div>
                  <CardDescription>
                    Prove you receive email from your government — without revealing who you are
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    Governments already send DKIM-signed email: tax receipts, national ID portal confirmations,
                    health-fund notices. A citizen proves, in zero knowledge, "I received an email from an
                    allowlisted government domain, addressed to an inbox I control":
                  </p>
                  <ul className="space-y-2 list-disc pl-6">
                    <li>
                      Your email address is <strong>never revealed</strong> — only a nullifier
                      (Poseidon hash of the recipient address) goes on-chain
                    </li>
                    <li>One nullifier per email address — one registration per government-known inbox</li>
                    <li>Proof freshness: the email must be at most 90 days old</li>
                    <li>Membership lasts 365 days and is renewable with a fresh proof from the same inbox</li>
                    <li>No government cooperation, API, or notary required — DKIM signatures already exist</li>
                  </ul>
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium">How It Works</h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      You download the .eml file of a government email from your inbox and load it into the browser
                      prover. A zkEmail circuit (running as WASM on your machine) verifies the DKIM signature and
                      produces a Groth16 proof exposing only: the DKIM key hash, the sender domain hash, your
                      nullifier, and the email timestamp. The IdentityRegistry contract checks the domain against
                      the per-community allowlist, checks the DKIM key against the on-chain DKIMRegistry, consumes
                      the nullifier, and enrolls your wallet. The email body, headers, and your address stay private.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-primary" />
                    <CardTitle>Event Verification</CardTitle>
                  </div>
                  <CardDescription>News events proven from DKIM-signed newsletters, by any subscriber</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    Redistribution events are proven from newsletters and breaking-news alerts that news
                    organizations already DKIM-sign:
                  </p>
                  <ul className="space-y-2 list-disc pl-6">
                    <li>
                      <strong>Any subscriber can attest</strong> — no monitoring service, notary, or oracle to
                      censor, bribe, or DDoS
                    </li>
                    <li>
                      Evidence survives article edits, retractions, and takedowns — the DKIM signature is frozen at
                      send time
                    </li>
                    <li>
                      Per-email nullifier (hash of the DKIM signature): each physical email counts once, but
                      different sources and editions each count
                    </li>
                    <li>
                      Distinct-source thresholds: at least 1 source from each community and 2 international
                      sources, within a 7-day event window
                    </li>
                  </ul>
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium">How It Works</h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      Each approved incentive commits on-chain to a compiled keyword pattern (patternHash). A
                      subscriber proves their saved newsletter email matches that exact pattern and came from an
                      approved source domain, then submits the proof to the EventAttestation contract. The contract
                      tallies distinct sender domains per category; when thresholds are met the event is confirmed,
                      a 48-hour dispute window opens, and only then does redistribution execute.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    <CardTitle>Technical Implementation</CardTitle>
                  </div>
                  <CardDescription>The cryptographic foundation of our verification system</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium">DKIM Signatures as the Trust Anchor</h3>
                      <p className="text-muted-foreground mt-1">
                        Every serious mail sender signs outgoing mail with DKIM (RFC 6376): the mail server signs
                        the canonicalized headers and body hash with an RSA key published in DNS. p2p2p adds no new
                        trust assumption beyond DNS/DKIM, which the entire email ecosystem already relies on. An
                        on-chain DKIMRegistry archives keys with validity windows (keys rotate every 6–12 months)
                        and supports immediate revocation of compromised keys.
                      </p>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">Client-Side Zero-Knowledge Proving</h3>
                      <p className="text-muted-foreground mt-1">
                        Proofs are generated on the user&apos;s own machine (browser WASM via the zk-email SDK,
                        roughly 10–60 seconds on a desktop). The circuit verifies the DKIM RSA signature, matches
                        the sender domain and body regexes, and derives the nullifier and timestamp. Only these
                        public signals are submitted; the raw email never leaves the device. No relayer is
                        required, but any relayer can submit on a user&apos;s behalf for gasless UX — proofs are
                        self-contained and bind the target wallet, so they cannot be redirected.
                      </p>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">On-Chain Verification</h3>
                      <p className="text-muted-foreground mt-1">
                        The ZKEmailVerifier contract checks each proof in two steps: (1) the DKIM key hash must be
                        registered and unrevoked for the sender domain in the DKIMRegistry, and (2) the Groth16
                        proof must verify against the verifying key registered for the pattern commitment
                        (patternHash) — so voters approve an exact circuit, not prose. All results are recorded
                        on-chain, immutable and auditable.
                      </p>
                    </div>
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium">Security Measures</h4>
                      <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground mt-2">
                        <li>Nullifiers prevent replay: per-address for identity, per-email for attestations</li>
                        <li>
                          Distinct-source thresholds mean a single captured newsroom or one compromised DKIM key
                          cannot fire an event alone
                        </li>
                        <li>Domain allowlist changes go through governance with a 48-hour timelock</li>
                        <li>Guardian can revoke leaked DKIM keys immediately and pause attestation (auto-expiring)</li>
                        <li>Open-source circuits and contracts for community review</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild>
            <Link href="/verify">
              Get Verified
              <UserCheck className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/attest">
              Attest an Event
              <Mail className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/governance">
              Learn About Governance
              <Shield className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  )
}

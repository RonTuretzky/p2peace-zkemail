import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SectionChip, SectionHeading, HonestyNote } from "@/components/explainer"

/* Verification, explained — the deep companion to the homepage trust section:
   DKIM, pattern pinning, the two nullifiers, the key registry, renewal, and
   exactly what is (and isn't) linkable on-chain. */

const NULLIFIERS = [
  {
    title: "Identity nullifier — one per inbox",
    formula: "Poseidon(recipient address, salt)",
    body: "When you prove citizenship, the circuit derives a nullifier from your email address. The address itself never appears — only this hash — but the same inbox always produces the same nullifier, so it can only ever be registered once. One government-known inbox, one membership, one vote. Ten wallets won't help you; they'd all collide on the same nullifier.",
  },
  {
    title: "Attestation nullifier — one per email",
    formula: "Poseidon(DKIM signature)",
    body: "When anyone attests a news event, the nullifier is derived from the newsletter's unique DKIM signature. The same physical email can never be counted twice — but a different edition, or the same story from a different outlet, is a different signature and counts separately. Exactly what you want: dedup without silencing corroboration.",
  },
]

const PRIVACY_ROWS = [
  { fact: "Your wallet address and community (A or B)", visible: true },
  { fact: "Your identity nullifier — an opaque hash", visible: true },
  { fact: "Which government domain signed your email (as a hash)", visible: true },
  { fact: "When you registered and when your membership expires", visible: true },
  { fact: "Your email address", visible: false },
  { fact: "Your name, or anything in the email body", visible: false },
  { fact: "Which specific email you used", visible: false },
  { fact: "A list linking members to inboxes — it never exists, anywhere", visible: false },
]

export default function VerificationPage() {
  return (
    <>
      <section className="container mx-auto px-4 py-14">
        {/* -------------------------------- hero -------------------------------- */}
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <SectionChip>Verification, explained</SectionChip>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Everything is built on signed email
          </h1>
          <p className="text-muted-foreground md:text-lg">
            Both trust roots of p2p2p — who counts as a citizen, and what counts as news — reduce to
            the same primitive: mail servers cryptographically sign what they send, and
            zero-knowledge proofs let you use those signatures without revealing the mail. This page
            is the deep version of the homepage trust story: how each piece works, and what an
            adversary would have to break.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild>
              <Link href="/verify">Get verified — /verify</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/attest">Attest an event — /attest</Link>
            </Button>
          </div>
        </div>

        {/* -------------------------------- DKIM -------------------------------- */}
        <div className="mx-auto mt-16 max-w-5xl">
          <SectionHeading
            chip="The trust anchor"
            title="DKIM: the signature the internet already runs on"
            lede="Every serious sender — governments, newsrooms, banks — signs outgoing mail with DKIM (RFC 6376): the mail server signs the headers and body hash with an RSA key published in DNS. It's how your inbox knows a tax receipt really came from the tax office."
          />
          <div className="mx-auto mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border-2 border-border bg-card p-6">
              <h3 className="font-display text-lg font-bold">Why it's the right foundation</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                p2p2p adds <em>no new trust assumption</em>: if DKIM were broken, email itself would
                be broken, and the world would have far bigger problems. Crucially, neither
                governments nor newsrooms need to cooperate, integrate an API, or even know the
                protocol exists — they already emit the evidence every day, signed, into millions of
                inboxes. And a signature is frozen at send time: an article can be edited, retracted,
                or taken down, but the newsletter that announced it stays provable forever.
              </p>
            </div>
            <div className="rounded-3xl border-2 border-border bg-card p-6">
              <h3 className="font-display text-lg font-bold">The proof never leaves home</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                You download the .eml file and load it into a prover running in your own browser
                (WASM, via the zk-email SDK — roughly 10–60 seconds on a laptop). The circuit
                verifies the RSA signature and the required patterns, then emits only public
                signals: key hash, domain hash, nullifier, pattern hash, timestamp. The raw email
                never leaves your device. The proof also binds your wallet, so a relayer can submit
                it for gasless UX but can never redirect it.
              </p>
            </div>
          </div>
        </div>

        {/* --------------------------- pattern pinning --------------------------- */}
        <div className="mx-auto mt-20 max-w-5xl">
          <SectionHeading
            chip="Blueprints & pinning"
            title="Voters approve a circuit, not a description"
            lede="What a proof is allowed to claim is pinned in advance — cryptographically."
          />
          <div className="mx-auto mt-8 max-w-3xl rounded-3xl border-2 border-border bg-card p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Every kind of proof runs through a <strong className="text-foreground">blueprint</strong> —
              a zk-regex circuit compiled from explicit matching rules ("from an allowlisted
              government domain, matching the official notice template" for citizenship; the
              committed keyword logic for each news incentive). The chain stores each blueprint's
              hash — its <strong className="text-foreground">patternHash</strong> — next to the
              verifying key, and the ZKEmailVerifier accepts a proof only if it verifies against the
              key registered for exactly that hash. The consequence is subtle but decisive: when a
              community votes on an incentive, it votes on a specific machine whose behavior anyone
              can test against real newsletters beforehand. There is no prose to reinterpret later,
              no judge who decides after the fact what "checkpoint removal" meant. The words were
              compiled before the vote; the vote approved the compilation.
            </p>
          </div>
        </div>

        {/* ------------------------------ nullifiers ------------------------------ */}
        <div className="mx-auto mt-20 max-w-5xl">
          <SectionHeading
            chip="Nullifiers"
            title="Two hashes carry the whole anti-abuse story"
            lede="Uniqueness without identification: each proof consumes a nullifier, and the contract just checks it hasn't been seen before."
          />
          <div className="mx-auto mt-10 grid gap-6 sm:grid-cols-2">
            {NULLIFIERS.map((n) => (
              <div key={n.title} className="rounded-3xl border-2 border-border bg-card p-6">
                <h3 className="font-display text-lg font-bold">{n.title}</h3>
                <p className="mt-2 rounded-lg bg-muted/60 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                  {n.formula}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ------------------------- key registry & renewal ------------------------- */}
        <div className="mx-auto mt-20 max-w-5xl">
          <SectionHeading
            chip="Key lifecycle"
            title="Keys rotate, leak, and expire — the registry keeps up"
            lede="DKIM keys are the one thing that can actually break this system, so their lifecycle is managed on-chain."
          />
          <div className="mx-auto mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border-2 border-border bg-card p-6">
              <h3 className="font-display text-lg font-bold">Archive with validity windows</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Senders rotate DKIM keys every 6–12 months and delete old ones from DNS — which
                would silently strand old evidence. The DKIMRegistry archives every key on-chain
                with the window in which it was valid, so an email stays provable for as long as it
                matters, not for as long as a DNS record survives. New keys are added through the
                timelocked governance path.
              </p>
            </div>
            <div className="rounded-3xl border-2 border-border bg-card p-6">
              <h3 className="font-display text-lg font-bold">Revocation in minutes</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A leaked signing key would let an attacker forge "government email" or "newsletters"
                wholesale — the worst failure the threat model contains. That's why revocation is
                the guardian's one fast power: a compromised key is killed immediately, no timelock,
                and every proof depending on it stops verifying at once. The guardian's own pause
                powers auto-expire, so the emergency brake can't become a handbrake.
              </p>
            </div>
            <div className="rounded-3xl border-2 border-border bg-card p-6 sm:col-span-2">
              <h3 className="font-display text-lg font-bold">Membership renewal &amp; wallet rotation</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A membership isn't forever — it expires after 365 days and is renewed with a fresh
                proof (the email itself must be under 90 days old at proof time), so the rolls track
                people who still receive government mail, not addresses registered once in 2026.
                Lost your keys? Prove again from the same inbox: the identical nullifier lets you
                rotate to a new wallet without creating a second identity — and your pool claims and
                voting rights follow the identity, not the wallet.
              </p>
            </div>
          </div>
        </div>

        {/* ---------------------------- privacy table ---------------------------- */}
        <div className="mx-auto mt-20 max-w-5xl">
          <SectionHeading
            chip="Privacy properties"
            title="What the chain sees — and what it can never see"
            lede="Membership in a conflict-zone protocol is sensitive. These properties aren't a policy promise; they're what the proof system does and doesn't reveal."
          />
          <div className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
            {PRIVACY_ROWS.map((r) => (
              <div
                key={r.fact}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
                  r.visible ? "border-border bg-card" : "border-primary/40 bg-accent/20"
                }`}
              >
                <span
                  className={`mt-0.5 flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    r.visible
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  {r.visible ? "ON-CHAIN" : "NEVER"}
                </span>
                <span className="text-muted-foreground">{r.fact}</span>
              </div>
            ))}
          </div>
          <HonestyNote>
            The honest limit: your wallet's transactions are public like on any chain, and being
            verified reveals that <em>some</em> government-known inbox backs your wallet — just never
            which one. If your wallet is linked to you by other means, your membership and community
            are too. Keep the wallet clean if that matters for your situation.
          </HonestyNote>
        </div>

        {/* --------------------------------- CTA --------------------------------- */}
        <div className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-4 rounded-3xl border-2 border-primary/40 bg-card p-8 text-center">
          <h2 className="font-display text-2xl font-bold">Verify yourself in two minutes</h2>
          <p className="text-sm text-muted-foreground">
            The live flow builds a structurally real proof (this demo's mock verifier skips only the
            WASM proving step) and registers your wallet on Gnosis — nullifier, expiry, community
            roll and all. It's the first step of the whole journey.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/verify">Start verification — /verify</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/docs">Read the full docs</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

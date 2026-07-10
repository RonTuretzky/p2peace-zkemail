import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GitBranch, ArrowUpRight } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MermaidDiagram } from "@/components/mermaid-diagram"
import { SectionChip, SectionHeading, HonestyNote } from "@/components/explainer"
import { ADDRESSES } from "@/lib/chains"

/* The five-step journey the whole protocol reduces to — every diagram below is
   one of these steps drawn in full detail. */
const JOURNEY_STEPS = [
  { label: "Verify", href: "/verify", blurb: "prove citizenship from a signed email" },
  { label: "Mint", href: "/mint", blurb: "1:1 tokens, 10% staked on peace" },
  { label: "Agree", href: "/incentives", blurb: "both sides vote the rules in" },
  { label: "Attest", href: "/attest", blurb: "newsletters become evidence" },
  { label: "Settle", href: "/pools", blurb: "dispute window, then dividend" },
]

/* One-line role for every deployed contract, in ADDRESSES order. */
const CONTRACTS: { key: keyof typeof ADDRESSES; name: string; role: string }[] = [
  { key: "reserveToken", name: "sDAI (reserve)", role: "Savings xDAI on Gnosis — the real reserve asset backing both community tokens; stands in for a real stablecoin." },
  { key: "dkimRegistry", name: "DKIMRegistry", role: "On-chain archive of mail-server signing keys per domain, with validity windows and instant revocation." },
  { key: "zkEmailVerifier", name: "ZKEmailVerifier", role: "Checks every email proof twice: DKIM key registered and unrevoked, then Groth16 proof valid for the pinned pattern." },
  { key: "mockGroth16Verifier", name: "MockGroth16Verifier", role: "Demo stand-in that accepts demo proofs — swapped for compiled circuit verifiers in production." },
  { key: "identityRegistry", name: "IdentityRegistry", role: "One nullifier, one membership: community rolls, 365-day expiry, renewal and wallet rotation." },
  { key: "peaceTokenA", name: "PeaceToken A", role: "Community A's reserve-backed token — mints 1:1, redeems 1:1, always." },
  { key: "peaceTokenB", name: "PeaceToken B", role: "Community B's reserve-backed token — same rules, mirrored exactly." },
  { key: "treasury", name: "Treasury", role: "The shared reward chest: outsider premiums flow in; positive-event rewards and cooperation bonuses flow out." },
  { key: "communityPoolA", name: "CommunityPool A", role: "Holds A's staked peace corpus and the equal-per-member reward accumulator." },
  { key: "communityPoolB", name: "CommunityPool B", role: "Holds B's staked peace corpus and the equal-per-member reward accumulator." },
  { key: "peaceMinterA", name: "PeaceMinter A", role: "Mint routing for token A: citizens 1:1 with the 90/10 split, outsiders at 2× with the premium to Treasury." },
  { key: "peaceMinterB", name: "PeaceMinter B", role: "Mint routing for token B — identical logic." },
  { key: "incentiveRegistry", name: "IncentiveRegistry", role: "Proposals, quadratic dual-majority voting, the 30% quorum, and the ≤5% per-event cap." },
  { key: "eventAttestation", name: "EventAttestation", role: "Accepts newsletter proofs, tallies distinct sources per category inside the reporting window." },
  { key: "redistributionEngine", name: "RedistributionEngine", role: "Two-phase settlement: confirm → 48h dispute window → finalize, then value moves." },
  { key: "sanctionsEscrow", name: "SanctionsEscrow", role: "Outcome-conditional tranches from outside donors: release on a finalized event, reclaim after expiry." },
]

const REPO = "https://github.com/RonTuretzky/p2peace-zkemail"
const REPO_DOCS = [
  { name: "ARCHITECTURE.md", href: `${REPO}/blob/master/docs/ARCHITECTURE.md`, blurb: "The full system specification — every contract, every invariant, in one place." },
  { name: "ZKEMAIL-DESIGN.md", href: `${REPO}/blob/master/docs/ZKEMAIL-DESIGN.md`, blurb: "The proof system deep dive: EmailProof ABI, nullifier derivations, DKIM key lifecycle." },
  { name: "IMPROVEMENTS.md", href: `${REPO}/blob/master/docs/IMPROVEMENTS.md`, blurb: "An honest audit of the original concept and every deliberate deviation from it." },
  { name: "THREAT-MODEL.md", href: `${REPO}/blob/master/docs/THREAT-MODEL.md`, blurb: "What the protocol defends against, what it cannot, and why we say so out loud." },
]

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export default function DocsPage() {
  const verificationFlow = `sequenceDiagram
    participant U as User
    participant Inbox as Email Inbox
    participant P as Browser Prover (zk-email SDK, WASM)
    participant IR as IdentityRegistry
    participant V as ZKEmailVerifier
    participant DR as DKIMRegistry

    Note over U,Inbox: Obtain evidence (no government cooperation needed)
    U->>Inbox: Locate DKIM-signed government email (tax receipt, ID portal notice)
    Inbox->>U: Download raw .eml file

    Note over U,P: Client-side proving (email never leaves the device)
    U->>P: Load .eml + citizenship blueprint for the gov domain
    P->>P: Verify DKIM RSA signature in-circuit
    P->>P: Match from-domain and notice template regexes
    P->>P: Derive nullifier = Poseidon(recipient address, salt)
    P->>P: Generate Groth16 proof (public signals only)
    P->>U: EmailProof {dkimPubkeyHash, domainHash, nullifier, patternHash, emailTimestamp, proof}

    Note over U,DR: On-chain registration
    U->>IR: register(EmailProof, communityId, wallet)
    IR->>V: verify(EmailProof) with wallet bound as extra public input
    V->>DR: isKeyValid(domainHash, dkimPubkeyHash)?
    DR->>V: Key registered and not revoked
    V->>V: Groth16 verify against verifying key for patternHash
    V->>IR: Proof valid
    IR->>IR: Check domain allowlisted for communityId
    IR->>IR: Check emailTimestamp within 90-day freshness window
    IR->>IR: Check nullifier unused (one identity per gov-known inbox)
    IR->>U: Wallet enrolled, membership valid 365 days (renewable)

    Note over U,IR: Member can now mint 1:1, vote, and claim pool rewards`

  const citizenMintingFlow = `sequenceDiagram
    participant C as Verified Citizen
    participant IR as IdentityRegistry
    participant PM as PeaceMinter
    participant PT as PeaceToken
    participant CP as CommunityPool

    C->>PM: mint(amount) with reserve asset (1:1 rate)
    PM->>IR: isVerifiedMember(wallet)?
    IR->>PM: Yes, community A, membership current
    PM->>PT: Mint tokens 1:1 against payment
    PT->>C: 90% of tokens to citizen wallet
    PT->>CP: 10% of tokens staked as peace stake
    Note over CP: The peace stake is the only capital exposed to redistribution.
    Note over CP: Staking it = consenting to the rebalancing agreement.
    CP->>CP: Stake joins pool corpus, slashable on harmful events
    Note over C,CP: Unstaked tokens are redeemable 1:1 and never touchable`

  const nonCitizenMintingFlow = `sequenceDiagram
    participant O as Outsider (no identity proof)
    participant PM as PeaceMinter
    participant PT as PeaceToken
    participant T as Treasury

    O->>PM: mint(amount) at outsider premium (default 2x)
    PM->>PM: Split payment in half
    PM->>PT: Mint tokens 1:1 against half the payment
    PT->>O: Tokens to outsider wallet
    PM->>T: Premium half of payment (reserve asset) to Treasury
    Note over T: Treasury funds positive-action rewards and cooperation bonuses
    Note over O: Same economic rights (hold, pay, redeem)
    Note over O: No voting - governance is identity-gated to the two communities`

  const proposalFlow = `sequenceDiagram
    participant U as Proposer (anyone, no tokens needed)
    participant KT as Keyword Tester (off-chain)
    participant ZR as zk-regex Compiler
    participant IRg as IncentiveRegistry
    participant Forum as Community Forum

    Note over U,KT: Draft and test the trigger
    U->>KT: Boolean keyword logic, e.g. (checkpoint removal OR withdrawal) AND (Jordan Valley)
    KT->>U: Matches against a personal newsletter archive
    U->>ZR: Compile keyword logic to a zk-regex blueprint
    ZR->>U: Compiled circuit + patternHash commitment

    Note over U,IRg: Submit on-chain (immutable)
    U->>IRg: propose(direction, patternHash, sources[] tagged A/B/Intl, thresholds, window, redistributionBps, maxTriggers, cooldown)
    IRg->>IRg: Check proposer not in 30-day rejection cooldown
    IRg->>Forum: Publish for 7-day discussion
    Note over Forum: Proposal is frozen on-chain - amendments require a new proposal
    Forum->>U: Feedback and analysis
    IRg->>IRg: After discussion, open 3-day quadratic vote
    Note over IRg: If passed, EventAttestation accepts proofs matching exactly this patternHash`

  const votingFlow = `sequenceDiagram
    participant M as Verified Member
    participant IR as IdentityRegistry
    participant IRg as IncentiveRegistry
    participant PT as PeaceToken

    Note over M,IR: Eligibility - identity-gated, one ballot per member
    M->>IRg: castVote(proposalId, n votes, yes/no)
    IRg->>IR: isVerifiedMember(wallet)? which community?
    IR->>IRg: Verified, community A
    IRg->>PT: Lock n*n whole tokens for the voting period
    PT->>IRg: Tokens locked
    IRg->>IRg: Record weight n toward community A tally

    Note over IRg: Tally after 3 days - all three required
    IRg->>IRg: Majority YES among community A vote weight?
    IRg->>IRg: Majority YES among community B vote weight?
    IRg->>IRg: Participation >= 30% of registered members (both communities)?

    alt All three satisfied
        IRg->>IRg: Incentive activated
        IRg->>PT: Unlock all voters' tokens
    else Any check fails
        IRg->>IRg: Proposal rejected, proposer enters 30-day cooldown
        IRg->>PT: Unlock all voters' tokens
    end
    Note over M,IRg: Dual majority - neither community can impose rules on the other`

  const redistributionFlow = `sequenceDiagram
    participant S as Newsletter Subscribers
    participant P as Browser Prover
    participant EA as EventAttestation
    participant RE as RedistributionEngine
    participant PX as CommunityPool X (aggressor)
    participant PY as CommunityPool Y (harmed)

    Note over S,EA: Permissionless attestation (7-day window)
    S->>P: Load saved newsletter .eml matching incentive keywords
    P->>P: Prove DKIM signature + pattern match, nullifier = Poseidon(dkimSignature)
    P->>S: EmailProof
    S->>EA: attest(incentiveId, EmailProof)
    EA->>EA: Verify proof, check domain in approved source set
    EA->>EA: Check timestamp inside event window
    EA->>EA: Tally distinct source domains per category (A / B / Intl)

    Note over EA,RE: Thresholds met (>=1 A, >=1 B, >=2 Intl)
    EA->>RE: Event CONFIRMED
    RE->>RE: Open 48h public-notice window (guardian may pause settlement)

    Note over RE: Window passes untouched
    RE->>RE: Event FINALIZED
    RE->>PX: Slash redistributionBps of pool X pledge
    PX->>RE: Redeem slashed units to reserve (sDAI) 1:1
    RE->>PY: Mint community Y money at par into pool Y rewards
    PY->>PY: rewardPerMember accumulator increases
    Note over PY: Verified members of Y claim equal per-member shares
    RE->>RE: Release any SanctionsEscrow tranches referencing this incentive`

  return (
    <>
      <section className="container mx-auto px-4 py-14">
        {/* ------------------------------- intro ------------------------------- */}
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <SectionChip>Documentation</SectionChip>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            The whole protocol, drawn out
          </h1>
          <p className="text-muted-foreground md:text-lg">
            Everything p2p2p does reduces to one journey — <strong className="text-foreground">Verify →
            Mint → Agree → Attest → Settle</strong>. The sequence diagrams below draw each step in
            full contract-level detail, and every diagram links to the live page where you can run
            it on Gnosis right now.
          </p>
        </div>

        {/* The journey, as a strip of links */}
        <nav aria-label="The protocol journey" className="mx-auto mt-8 max-w-4xl">
          <ol className="flex flex-wrap items-center justify-center gap-2">
            {JOURNEY_STEPS.map((s, i) => (
              <li key={s.href} className="flex items-center gap-2">
                <Link
                  href={s.href}
                  className="flex flex-col rounded-xl border border-border px-3 py-2 transition-colors hover:border-primary/50"
                >
                  <span className="text-sm font-semibold">
                    {i + 1}. {s.label}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">{s.blurb}</span>
                </Link>
                {i < JOURNEY_STEPS.length - 1 && (
                  <span aria-hidden className="text-muted-foreground/50">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/verify">Start the journey — verify</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/user-demos">Scripted walkthroughs</Link>
          </Button>
        </div>

        {/* ------------------------------ diagrams ------------------------------ */}
        <div className="mx-auto mt-14 max-w-6xl">
          <Tabs defaultValue="verification" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="verification">Verify</TabsTrigger>
              <TabsTrigger value="minting">Mint</TabsTrigger>
              <TabsTrigger value="proposing">Propose</TabsTrigger>
              <TabsTrigger value="voting">Agree</TabsTrigger>
              <TabsTrigger value="redistribution">Attest &amp; Settle</TabsTrigger>
            </TabsList>

            <TabsContent value="verification" className="mt-6 space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    Verify — one signed email becomes one membership
                  </CardTitle>
                  <CardDescription>
                    You already receive DKIM-signed email from your government. A zero-knowledge
                    proof, generated entirely on your device, turns one such email into one on-chain
                    membership — without your address, name, or the email itself ever leaving your
                    machine.{" "}
                    <Link href="/verify" className="font-medium text-primary underline underline-offset-4">
                      Run this step live at /verify →
                    </Link>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MermaidDiagram chart={verificationFlow} id="verification-flow" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="minting" className="mt-6 space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    Mint — buying in is signing the peace deal
                  </CardTitle>
                  <CardDescription>
                    Citizens mint 1:1 against the reserve: 90% lands in their wallet, 10% is staked
                    into their community's peace pool — the only money redistribution can ever
                    touch. Outsiders pay 2×, and the premium funds the shared Treasury.{" "}
                    <Link href="/mint" className="font-medium text-primary underline underline-offset-4">
                      Run this step live at /mint →
                    </Link>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="mb-4 font-medium">Verified citizen (1:1, with the 90/10 split)</h4>
                    <MermaidDiagram chart={citizenMintingFlow} id="citizen-minting-flow" />
                  </div>
                  <div>
                    <h4 className="mb-4 font-medium">Outsider (2× premium to Treasury, no vote)</h4>
                    <MermaidDiagram chart={nonCitizenMintingFlow} id="non-citizen-minting-flow" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="proposing" className="mt-6 space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    Propose — anyone writes a trigger, machines keep it honest
                  </CardTitle>
                  <CardDescription>
                    No tokens, no fee. Keyword logic is compiled to an exact zk-regex circuit and
                    committed on-chain as a hash — so what voters approve is a machine, not prose
                    that can be reinterpreted later.{" "}
                    <Link href="/propose-incentive" className="font-medium text-primary underline underline-offset-4">
                      Read the proposer's guide
                    </Link>{" "}
                    or{" "}
                    <Link href="/incentives" className="font-medium text-primary underline underline-offset-4">
                      propose live at /incentives →
                    </Link>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MermaidDiagram chart={proposalFlow} id="proposal-flow" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="voting" className="mt-6 space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    Agree — n votes cost n² tokens, and both sides must say yes
                  </CardTitle>
                  <CardDescription>
                    Quadratic voting only works when identities can't be split — here every ballot
                    is one verified person. A rule activates only with a YES majority in each
                    community plus 30% joint participation.{" "}
                    <Link href="/incentives" className="font-medium text-primary underline underline-offset-4">
                      Vote live at /incentives →
                    </Link>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MermaidDiagram chart={votingFlow} id="voting-flow" />
                </CardContent>
              </Card>
            </TabsContent>


            <TabsContent value="redistribution" className="mt-6 space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    Attest &amp; Settle — newsletters in, dividend out
                  </CardTitle>
                  <CardDescription>
                    Any subscriber proves a DKIM-signed newsletter matches an approved incentive.
                    When enough distinct sources agree, the event confirms, waits out the dispute
                    window, and then — and only then — value moves pool-to-pool and pays out equally
                    per member.{" "}
                    <Link href="/attest" className="font-medium text-primary underline underline-offset-4">
                      Attest live at /attest →
                    </Link>{" "}
                    ·{" "}
                    <Link href="/pools" className="font-medium text-primary underline underline-offset-4">
                      settle &amp; claim at /pools →
                    </Link>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MermaidDiagram chart={redistributionFlow} id="redistribution-flow" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ------------------------------ contracts ------------------------------ */}
        <div className="mx-auto mt-20 max-w-6xl">
          <SectionHeading
            chip="Contracts"
            title="Every contract, live on Gnosis"
            lede="The demo deployment this site talks to. Every address is public and inspectable — click through to Blockscout and read the state yourself."
          />
          <div className="mx-auto mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONTRACTS.map((c) => {
              const addr = ADDRESSES[c.key]
              return (
                <div key={c.key} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-bold">{c.name}</h3>
                    <a
                      href={`https://gnosis.blockscout.com/address/${addr}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-accent/50 px-2 py-0.5 font-mono text-[11px] font-medium text-accent-foreground transition-colors hover:bg-accent"
                    >
                      {short(addr)}
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{c.role}</p>
                </div>
              )
            })}
          </div>
          <HonestyNote>
            Addresses are the DEMO_SETUP broadcast: 10-minute governance and dispute windows, and a
            mock Groth16 verifier that accepts demo proofs so the loop is clickable end to end. A
            production deployment swaps the mock for compiled circuit verifiers and restores
            day-scale windows — nothing else changes.
          </HonestyNote>
        </div>

        {/* ------------------------------ repo docs ------------------------------ */}
        <div className="mx-auto mt-20 max-w-6xl">
          <SectionHeading
            chip="Go deeper"
            title="The written specifications"
            lede="Four documents in the repository cover everything this site simplifies — including, honestly, what the protocol cannot do."
          />
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
            {REPO_DOCS.map((d) => (
              <a
                key={d.name}
                href={d.href}
                target="_blank"
                rel="noreferrer"
                className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-sm font-bold group-hover:text-primary">{d.name}</h3>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d.blurb}</p>
              </a>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="outline" asChild>
              <a href={REPO} target="_blank" rel="noreferrer">
                Full repository on GitHub
              </a>
            </Button>
            <Button asChild>
              <Link href="/user-demos">Walk the scripted demos</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

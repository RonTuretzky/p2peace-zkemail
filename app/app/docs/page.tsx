import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, GitBranch } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MermaidDiagram } from "@/components/mermaid-diagram"

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

  const businessFlow = `sequenceDiagram
    participant B as Business
    participant BR as BusinessRegistry
    participant M as Community Members
    participant Payer as Customer (community A)
    participant PT as PeaceToken
    participant T as Treasury

    Note over B,M: Peace-abiding certification
    B->>BR: apply(wallet, metadata URI)
    BR->>M: Open 3-day certification vote
    M->>BR: Simple majority of each community roll
    alt Approved by both rolls
        BR->>B: Certified (revocable by the same vote)
    else Rejected
        BR->>B: Not certified, may reapply
    end

    Note over Payer,T: Cross-community cooperation bonus
    Payer->>PT: payBusiness(business, amount)
    PT->>BR: Is business certified? Which community?
    BR->>PT: Certified, community B
    PT->>B: Transfer amount to business
    alt Payer and business communities differ
        PT->>T: Request cooperationBonusBps bonus
        T->>B: Bonus paid from Treasury
        Note over T: Cross-border commerce is subsidized, not taxed
    else Same community
        Note over PT: Standard transfer, no bonus
    end`

  const redistributionFlow = `sequenceDiagram
    participant S as Newsletter Subscribers
    participant P as Browser Prover
    participant EA as EventAttestation
    participant RE as RedistributionEngine
    participant DC as DisputeCouncil
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
    RE->>RE: Open 48h dispute window, freeze event amount in pool X

    alt Council reverses (75% supermajority within window)
        DC->>RE: reverse(eventId)
        RE->>PX: Unfreeze - no funds move
    else Window passes
        RE->>RE: Event FINALIZED (irreversible)
        RE->>PX: Slash redistributionBps of pool X corpus
        PX->>RE: Redeem slashed tokens to reserve (USD) 1:1
        RE->>PY: Mint community Y tokens at par into pool Y rewards
        PY->>PY: rewardPerMember accumulator increases
        Note over PY: Verified members of Y claim equal-per-member peace dividend
        RE->>RE: Release any SanctionsEscrow tranches referencing this incentive
    end`

  return (
    <>
      <section className="container mx-auto px-4 py-14">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Technical Documentation
          </h1>
          <p className="text-muted-foreground md:text-lg">
            Sequence diagrams for the p2p2p (peer to peer to peace) system as implemented — zkEmail
            proofs, peace pools with a 10% opt-in stake, and the two-phase event state machine.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild>
              <Link href="/user-demos">View Interactive Demos</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/verify">Get Verified</Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl mt-12">
              <Tabs defaultValue="verification" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="verification">Identity Verification</TabsTrigger>
                  <TabsTrigger value="minting">Token Minting</TabsTrigger>
                  <TabsTrigger value="proposing">Propose Incentive</TabsTrigger>
                  <TabsTrigger value="voting">Voting</TabsTrigger>
                  <TabsTrigger value="business">Business Integration</TabsTrigger>
                  <TabsTrigger value="redistribution">Redistribution</TabsTrigger>
                </TabsList>

                <TabsContent value="verification" className="mt-6 space-y-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GitBranch className="h-5 w-5" />
                        Identity Verification Flow
                      </CardTitle>
                      <CardDescription>
                        Citizenship proven from a DKIM-signed government email — proving runs client-side, only the
                        nullifier and public signals go on-chain
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
                        Token Minting Flow
                      </CardTitle>
                      <CardDescription>
                        Citizens mint 1:1 with a 90/10 split (wallet / peace stake); outsiders pay a premium that
                        funds the Treasury
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <h4 className="font-medium mb-4">Verified Citizen Minting (90/10 split)</h4>
                        <MermaidDiagram chart={citizenMintingFlow} id="citizen-minting-flow" />
                      </div>

                      <div>
                        <h4 className="font-medium mb-4">Outsider Minting (premium to Treasury, no vote)</h4>
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
                        Incentive Proposal Flow
                      </CardTitle>
                      <CardDescription>
                        Keyword logic is compiled to a zk-regex and committed as patternHash — voters approve an
                        exact circuit, not prose
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
                        Governance Voting Flow
                      </CardTitle>
                      <CardDescription>
                        Quadratic voting for verified members only — n votes lock n² tokens — with dual majority and
                        30% participation
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MermaidDiagram chart={votingFlow} id="voting-flow" />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="business" className="mt-6 space-y-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GitBranch className="h-5 w-5" />
                        Business Integration Flow
                      </CardTitle>
                      <CardDescription>
                        Peace-abiding certification by member vote, and cross-community cooperation bonuses paid
                        from the Treasury
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MermaidDiagram chart={businessFlow} id="business-flow" />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="redistribution" className="mt-6 space-y-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GitBranch className="h-5 w-5" />
                        Peace-Pool Redistribution Flow
                      </CardTitle>
                      <CardDescription>
                        Newsletter attestations → CONFIRMED → 48h dispute → FINALIZED → pool-to-pool value transfer
                        → equal-per-member claims
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MermaidDiagram chart={redistributionFlow} id="redistribution-flow" />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <Card className="mt-12">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Additional Technical Resources
                  </CardTitle>
                  <CardDescription>
                    Detailed specifications live in the monorepo alongside this app
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">System Architecture</h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>• docs/ARCHITECTURE.md — full system specification</li>
                        <li>• docs/ZKEMAIL-DESIGN.md — proof-system deep dive (EmailProof ABI, nullifiers, DKIM lifecycle)</li>
                        <li>• docs/IMPROVEMENTS.md — audit of the original zkTLS proposal and every deviation</li>
                        <li>• docs/THREAT-MODEL.md — attacks and mitigations</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Implementation</h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>• contracts/ — Foundry project (registries, pools, minter, engine, escrow)</li>
                        <li>• circuits/ — zkEmail blueprint specs and zk-regex compilation notes</li>
                        <li>• Proof generation walkthrough using the zk-email SDK</li>
                        <li>• Mock Groth16 verifier with the exact public-signal ABI for tests</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-4">
                    <Button variant="outline" asChild>
                      <Link href="/user-demos">View Interactive Demos</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/attest">Attest an Event</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/governance">Governance Details</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
        </div>
      </section>
    </>
  )
}

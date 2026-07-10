"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  useAccount,
  useBlock,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi"
import { keccak256, parseUnits, toBytes } from "viem"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Gavel, Vote, FilePlus2, Megaphone, ExternalLink, Undo2, ArrowRight } from "lucide-react"
import { ConnectGate, FlowHeader, TxButton, useMembership } from "@/components/flow"
import { JourneyBar, HonestyNote, PrereqNote } from "@/components/explainer"
import { contract } from "@/lib/contracts"
import { Community, Direction, SourceCategory } from "@/lib/chains"
import { demoSources, domainHashOf, NEWS_PATTERN } from "@/lib/demo"
import { fmt, short, DIRECTION_LABEL } from "@/lib/format"

const incentiveContract = contract.incentive()
const identityContract = contract.identity()

// The demo deployment runs 5-minute governance floors (setParams), so a full
// propose → discuss → vote → finalize cycle is ~10 minutes end to end.
const WINDOW_COPY = "Governance windows on this demo are ~10 minutes (5-min discussion + 5-min vote), not the 7/3-day production defaults."

type Phase = "Discussion" | "Voting" | "Ended"

/** Decoded proposalState struct as returned by the ABI tuple. */
interface ProposalState {
  proposer: `0x${string}`
  direction: number
  patternHash: `0x${string}`
  createdAt: bigint
  discussionEnd: bigint
  votingEnd: bigint
  finalized: boolean
  passed: boolean
  active: boolean
  yesA: bigint
  noA: bigint
  yesB: bigint
  noB: bigint
  participants: bigint
  triggerCount: number
  maxTriggers: number
  redistributionBps: number
  descriptionURI: string
}

function phaseOf(s: ProposalState, now: bigint): Phase {
  if (now < s.discussionEnd) return "Discussion"
  if (now < s.votingEnd) return "Voting"
  return "Ended"
}

export default function IncentivesPage() {
  return (
    <div className="container mx-auto px-4 py-14">
      <FlowHeader
        title="Write the Rules Together"
        blurb="Propose the rules both communities will live by, then approve them together. Voters approve an exact committed keyword circuit — a machine, not prose that can drift — and no rule activates without a YES majority on each side."
      />
      <IncentivesJourney />
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
        Why this step exists: money should never move because one side says so. Before any
        newsletter can trigger a transfer, <em>both</em> communities have to vote, in advance and
        in public, that this exact kind of event should — agreeing on the rule while nobody knows
        who it will cost.
      </p>
      <ConnectGate>
        <IncentivesInner />
      </ConnectGate>
      <HonestyNote>
        Honest limit: passing needs quorum plus a separate majority in <em>both</em> communities —
        a proposal one side hates simply dies, and a low-turnout vote dies too. That deadlock is a
        feature, not a bug: nothing can ever redistribute unless both sides agreed in advance that
        it should.
      </HonestyNote>
    </div>
  )
}

/** Journey state: verified ⇒ /verify done; holding community tokens ⇒ /mint done. */
function IncentivesJourney() {
  const { address } = useAccount()
  const membership = useMembership()
  const isCitizen = membership.isActiveMember && membership.community !== Community.None
  const bal = useReadContract({
    ...contract.token(isCitizen ? membership.community : Community.A),
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isCitizen },
  })
  const done = [
    ...(isCitizen ? ["/verify"] : []),
    ...(((bal.data as bigint | undefined) ?? 0n) > 0n ? ["/mint"] : []),
  ]
  return <JourneyBar current="/incentives" done={done} />
}

function IncentivesInner() {
  const membership = useMembership()
  const block = useBlock({ query: { refetchInterval: 5000 } })
  const now = block.data?.timestamp ?? BigInt(Math.floor(Date.now() / 1000))

  const count = useReadContract({
    ...incentiveContract,
    functionName: "incentiveCount",
  })
  const total = Number(count.data ?? 0n)

  // Multicall proposalState(id) for id = 1..count (ids are 1-indexed via ++incentiveCount).
  const states = useReadContracts({
    contracts: Array.from({ length: total }, (_, i) => ({
      ...incentiveContract,
      functionName: "proposalState" as const,
      args: [BigInt(i + 1)] as const,
    })),
    query: { enabled: total > 0 },
  })

  const incentives = useMemo(() => {
    if (!states.data) return []
    return states.data
      .map((r, i) => ({ id: BigInt(i + 1), state: r.result as ProposalState | undefined }))
      .filter((x): x is { id: bigint; state: ProposalState } => !!x.state && x.state.createdAt > 0n)
  }, [states.data])

  const refetchAll = () => {
    count.refetch()
    states.refetch()
  }

  return (
    <div className="mx-auto mt-10 max-w-5xl">
      <PrereqNote met={membership.isActiveMember} href="/verify" cta="Verify first">
        Browsing is open to everyone, but voting is one-person-one-ballot — so casting or
        proposing needs a verified membership.
      </PrereqNote>
      <p className="mb-6 mt-6 rounded-lg bg-accent/40 p-3 text-center text-xs text-accent-foreground">
        {WINDOW_COPY}
      </p>
      <Tabs defaultValue="list">
        <TabsList className="mx-auto grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="list">
            <Gavel className="mr-2 h-4 w-4" /> Incentives
          </TabsTrigger>
          <TabsTrigger value="vote">
            <Vote className="mr-2 h-4 w-4" /> Vote
          </TabsTrigger>
          <TabsTrigger value="propose">
            <FilePlus2 className="mr-2 h-4 w-4" /> Propose
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <IncentiveList
            incentives={incentives}
            now={now}
            loading={states.isLoading || count.isLoading}
          />
        </TabsContent>

        <TabsContent value="vote" className="mt-6">
          <VotePanel
            incentives={incentives}
            now={now}
            membership={membership}
            onDone={refetchAll}
          />
        </TabsContent>

        <TabsContent value="propose" className="mt-6">
          <ProposePanel onDone={refetchAll} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------- list

function IncentiveList({
  incentives,
  now,
  loading,
}: {
  incentives: { id: bigint; state: ProposalState }[]
  now: bigint
  loading: boolean
}) {
  if (loading) {
    return <p className="text-center text-sm text-muted-foreground">Loading proposals…</p>
  }
  if (incentives.length === 0) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No incentives yet. Head to the Propose tab to create the first one.
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {incentives.map(({ id, state }) => (
        <IncentiveCard key={id.toString()} id={id} state={state} now={now} />
      ))}
    </div>
  )
}

function PhaseBadge({ phase, state }: { phase: Phase; state: ProposalState }) {
  if (phase === "Discussion") return <Badge variant="outline">Discussion</Badge>
  if (phase === "Voting") return <Badge>Voting open</Badge>
  if (!state.finalized) return <Badge variant="secondary">Awaiting finalize</Badge>
  return state.passed ? (
    <Badge className="bg-primary">Passed{state.active ? " · active" : ""}</Badge>
  ) : (
    <Badge variant="destructive">Rejected</Badge>
  )
}

function IncentiveCard({
  id,
  state,
  now,
}: {
  id: bigint
  state: ProposalState
  now: bigint
}) {
  const phase = phaseOf(state, now)
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            #{id.toString()} · {DIRECTION_LABEL[state.direction]}
          </CardTitle>
          <PhaseBadge phase={phase} state={state} />
        </div>
        <CardDescription className="truncate">
          {state.descriptionURI || "(no description)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <Tally label="Community A" yes={state.yesA} no={state.noA} />
          <Tally label="Community B" yes={state.yesB} no={state.noB} />
        </div>
        <Row label="Participants" value={state.participants.toString()} />
        <Row label="Redistribution" value={`${(state.redistributionBps / 100).toFixed(2)}%`} />
        <Row label="Triggers" value={`${state.triggerCount} / ${state.maxTriggers}`} />
        <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
          Read those numbers like this: each confirmed event moves at most{" "}
          {(state.redistributionBps / 100).toFixed(2)}% of the responsible pool, and this rule can
          only ever fire {state.maxTriggers} time{state.maxTriggers === 1 ? "" : "s"} total.
        </p>
        <Row
          label="Circuit (patternHash)"
          value={
            <span className="font-mono text-xs" title={state.patternHash}>
              {short(state.patternHash)}
            </span>
          }
        />
        <div className="flex gap-2 pt-1">
          <a
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/60"
            href={`/attest?incentive=${id.toString()}`}
          >
            <Megaphone className="h-3.5 w-3.5" /> Attest event
          </a>
          {phase === "Voting" && (
            <a
              className="inline-flex items-center gap-1 rounded-md border border-primary bg-accent/40 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-accent/60"
              href={`?tab=vote#vote-${id.toString()}`}
            >
              <Vote className="h-3.5 w-3.5" /> Vote
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Tally({ label, yes, no }: { label: string; yes: bigint; no: bigint }) {
  return (
    <div className="rounded-lg bg-muted p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-primary">▲ {yes.toString()}</span>
        <span className="text-destructive">▼ {no.toString()}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------- vote

function VotePanel({
  incentives,
  now,
  membership,
  onDone,
}: {
  incentives: { id: bigint; state: ProposalState }[]
  now: bigint
  membership: ReturnType<typeof useMembership>
  onDone: () => void
}) {
  const votable = incentives.filter((x) => phaseOf(x.state, now) === "Voting")
  const finalizable = incentives.filter(
    (x) => phaseOf(x.state, now) === "Ended" && !x.state.finalized,
  )
  const withdrawable = incentives.filter((x) => x.state.finalized)

  if (!membership.isActiveMember) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Voting is for verified citizens only.{" "}
          <a className="text-primary underline" href="/verify">
            Get verified
          </a>{" "}
          to cast quadratic votes.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 font-display text-lg font-semibold">Cast a quadratic vote</h3>
        {votable.length === 0 ? (
          <p className="text-sm text-muted-foreground">No proposals are in the voting phase right now.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {votable.map(({ id, state }) => (
              <VoteCard key={id.toString()} id={id} state={state} community={membership.community} onDone={onDone} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 font-display text-lg font-semibold">Finalize (anyone)</h3>
        {finalizable.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting to be finalized.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {finalizable.map(({ id, state }) => (
              <FinalizeCard key={id.toString()} id={id} state={state} onDone={onDone} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 font-display text-lg font-semibold">Withdraw vote stake</h3>
        {withdrawable.length === 0 ? (
          <p className="text-sm text-muted-foreground">You can reclaim locked tokens once a vote is finalized.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {withdrawable.map(({ id, state }) => (
              <WithdrawCard key={id.toString()} id={id} state={state} onDone={onDone} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function VoteCard({
  id,
  state,
  community,
  onDone,
}: {
  id: bigint
  state: ProposalState
  community: Community
  onDone: () => void
}) {
  const { address } = useAccount()
  const [votes, setVotes] = useState(1)
  const [support, setSupport] = useState(true)
  // Quadratic cost: N votes lock N² whole tokens of your community's PeaceToken.
  const costWei = parseUnits((votes * votes).toString(), 18)
  const tokenC = contract.token(community)

  const allowance = useReadContract({
    ...tokenC,
    functionName: "allowance",
    args: address ? [address, incentiveContract.address] : undefined,
    query: { enabled: !!address },
  })
  const needsApproval = (allowance.data as bigint | undefined ?? 0n) < costWei

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  if (receipt.isSuccess) {
    allowance.refetch()
    onDone()
  }
  const pending = isPending || receipt.isLoading

  const approve = () =>
    writeContract({ ...tokenC, functionName: "approve", args: [incentiveContract.address, costWei] })
  const cast = () =>
    writeContract({
      ...incentiveContract,
      functionName: "castVote",
      args: [id, support, BigInt(votes)],
    })

  return (
    <Card id={`vote-${id.toString()}`}>
      <CardHeader>
        <CardTitle className="text-base">
          #{id.toString()} · {DIRECTION_LABEL[state.direction]}
        </CardTitle>
        <CardDescription className="truncate">{state.descriptionURI}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSupport(true)}
            className={`rounded-lg border p-2 text-center transition-colors ${support ? "border-primary bg-accent/40 text-primary" : "border-border"}`}
          >
            ▲ Support
          </button>
          <button
            onClick={() => setSupport(false)}
            className={`rounded-lg border p-2 text-center transition-colors ${!support ? "border-destructive bg-destructive/10 text-destructive" : "border-border"}`}
          >
            ▼ Oppose
          </button>
        </div>
        <label className="block text-xs font-medium text-muted-foreground">Votes (1–5)</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={5}
            value={votes}
            onChange={(e) => setVotes(Number(e.target.value))}
            className="flex-1 accent-[var(--primary)]"
          />
          <span className="w-6 text-center font-medium">{votes}</span>
        </div>
        <Row label="Locked cost" value={`${votes * votes} PEACE-${community === Community.A ? "A" : "B"}`} />
        <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
          Read it like this: {votes} vote{votes > 1 ? "s" : ""} lock{votes > 1 ? "" : "s"}{" "}
          {votes * votes} token{votes * votes > 1 ? "s" : ""} — quadratic cost means shouting 5×
          louder costs 25× more, so conviction counts but wealth hits a wall. You get the stake
          back after finalize, win or lose.
        </p>
        {needsApproval ? (
          <TxButton className="w-full" pending={pending} onClick={approve}>
            Approve {votes * votes} tokens
          </TxButton>
        ) : (
          <TxButton className="w-full" pending={pending} onClick={cast}>
            Cast {votes} vote{votes > 1 ? "s" : ""}
          </TxButton>
        )}
        {receipt.isSuccess && (
          <p className="text-xs text-primary">
            Vote counted. When the window closes, finalize below — a passed incentive goes live
            for attestation.
          </p>
        )}
        {error && (
          <p className="text-xs text-destructive">
            {(error as { shortMessage?: string }).shortMessage || error.message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function FinalizeCard({ id, state, onDone }: { id: bigint; state: ProposalState; onDone: () => void }) {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  if (receipt.isSuccess) onDone()
  const pending = isPending || receipt.isLoading
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          #{id.toString()} · {DIRECTION_LABEL[state.direction]}
        </CardTitle>
        <CardDescription>Voting ended. Anyone can tally the result.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <TxButton
          className="w-full"
          pending={pending}
          onClick={() =>
            writeContract({ ...incentiveContract, functionName: "finalize", args: [id] })
          }
        >
          <Gavel className="mr-2 h-4 w-4" /> Finalize #{id.toString()}
        </TxButton>
        {receipt.isSuccess && (
          <p className="text-xs text-primary">
            Finalized. If it passed, the rule is live —{" "}
            <Link href={`/attest?incentive=${id.toString()}`} className="inline-flex items-center gap-1 font-medium underline">
              next: attest a matching newsletter <ArrowRight className="h-3 w-3" />
            </Link>
          </p>
        )}
        {error && (
          <p className="text-xs text-destructive">
            {(error as { shortMessage?: string }).shortMessage || error.message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function WithdrawCard({ id, state, onDone }: { id: bigint; state: ProposalState; onDone: () => void }) {
  const { address } = useAccount()
  // withdrawVoteStake is keyed by the caller's identity nullifier, not the wallet.
  const nullifier = useReadContract({
    ...identityContract,
    functionName: "nullifierOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  if (receipt.isSuccess) onDone()
  const pending = isPending || receipt.isLoading
  const nul = nullifier.data as `0x${string}` | undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          #{id.toString()} · {state.passed ? "Passed" : "Rejected"}
        </CardTitle>
        <CardDescription>Reclaim your quadratically-locked stake (win or lose).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <TxButton
          className="w-full"
          variant="outline"
          pending={pending}
          disabled={!nul}
          onClick={() =>
            nul &&
            writeContract({
              ...incentiveContract,
              functionName: "withdrawVoteStake",
              args: [id, nul],
            })
          }
        >
          <Undo2 className="mr-2 h-4 w-4" /> Withdraw stake
        </TxButton>
        {receipt.isSuccess && <p className="text-xs text-primary">Refunded.</p>}
        {error && (
          <p className="text-xs text-destructive">
            {(error as { shortMessage?: string }).shortMessage || error.message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------------- propose

const DIRECTION_OPTIONS = [
  Direction.HarmfulByA,
  Direction.HarmfulByB,
  Direction.PositiveForA,
  Direction.PositiveForB,
  Direction.Joint,
]

function ProposePanel({ onDone }: { onDone: () => void }) {
  const [direction, setDirection] = useState<Direction>(Direction.Joint)
  const [keyword, setKeyword] = useState("ceasefire holds along the border")

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  if (receipt.isSuccess) onDone()
  const pending = isPending || receipt.isLoading

  const propose = () => {
    const sources = demoSources()
    // NOTE: patternHash MUST equal NEWS_PATTERN so buildNewsProof-generated proofs
    // attest against this incentive on the demo (EventAttestation checks
    // proof.patternHash == incentive.patternHash). The keyword text below is the
    // human-readable description of the committed keyword circuit only — its own
    // keccak256 (shown as "committed keyword circuit") is illustrative, not the
    // on-chain pattern.
    const input = {
      direction,
      patternHash: NEWS_PATTERN,
      requiredA: 1,
      requiredB: 1,
      requiredIntl: 2,
      // Contract requires attestationWindow >= 1 day and triggerCooldown >= attestationWindow.
      attestationWindow: 86400,
      redistributionBps: 500, // == maxRedistributionBps (5%)
      maxTriggers: 3,
      triggerCooldown: 86400,
      sourceDomains: sources.map((s) => domainHashOf(s.domain)),
      categories: sources.map((s) => s.category),
      descriptionURI: keyword,
    }
    writeContract({ ...incentiveContract, functionName: "propose", args: [input] })
  }

  const committedCircuit = keyword ? keccak256(toBytes(keyword)) : undefined
  const src = demoSources()
  const countBy = (c: SourceCategory) => src.filter((s) => s.category === c).length

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-primary" /> New incentive
          </CardTitle>
          <CardDescription>
            Propose a news-event circuit. Free to propose; a rejected proposal puts the proposer on a
            cooldown before they can resubmit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(Number(e.target.value) as Direction)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {DIRECTION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {DIRECTION_LABEL[d]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Keyword description</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. ceasefire holds along the border"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Committed keyword circuit:{" "}
              <span className="font-mono">{committedCircuit ? short(committedCircuit) : "—"}</span>
            </p>
          </div>
          <TxButton className="w-full" pending={pending} onClick={propose}>
            <Megaphone className="mr-2 h-4 w-4" /> Submit proposal
          </TxButton>
          {receipt.isSuccess && (
            <p className="text-sm text-primary">
              Proposed. Switch to the Incentives tab to watch it enter discussion.
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive">
              {(error as { shortMessage?: string }).shortMessage || error.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preset parameters</CardTitle>
          <CardDescription>
            Sensible demo defaults that satisfy the contract&apos;s propose() validation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Pattern hash" value={<span className="font-mono text-xs">{short(NEWS_PATTERN)}</span>} />
          <Row label="Required A / B / Intl" value="1 / 1 / 2" />
          <Row label="Attestation window" value="1 day" />
          <Row label="Trigger cooldown" value="1 day" />
          <Row label="Redistribution" value="5% (max)" />
          <Row label="Max triggers" value="3" />
          <Row label="Approved sources" value={`${src.length} (A:${countBy(SourceCategory.CommunityA)} B:${countBy(SourceCategory.CommunityB)} Intl:${countBy(SourceCategory.International)})`} />
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <ExternalLink className="mr-1 inline h-3 w-3" />
            The demo commits <code>patternHash = NEWS_PATTERN</code> so that any proof built by{" "}
            <code>buildNewsProof</code> attests against this incentive. Voters approve the circuit,
            not the prose.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

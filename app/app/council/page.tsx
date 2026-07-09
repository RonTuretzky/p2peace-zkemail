"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Gavel, Scale, Timer, Users, XCircle } from "lucide-react"
import { ConnectGate, FlowHeader, TxButton } from "@/components/flow"
import { HonestyNote, JourneyBar, StatPill } from "@/components/explainer"
import type { Abi } from "viem"
import { contract } from "@/lib/contracts"
import { fmt, DIRECTION_LABEL, short } from "@/lib/format"
import { cn } from "@/lib/utils"

/* The Dispute Council page: cryptography narrows what needs judging, a small
   human council from both communities does the judging — and only inside the
   dispute window. Courts before bailiffs; no retroactive reversals. */

type Evt = {
  id: bigint
  incentiveId: bigint
  direction: number
  planned: bigint
  confirmedAt: number
  status: number // 1 Pending, 2 Finalized, 3 Reversed
}

/** votes needed = ceil(75% of the FULL council), matching votes*10000 >= 7500*memberCount. */
function thresholdOf(memberCount: number): number {
  return memberCount > 0 ? Math.ceil((memberCount * 3) / 4) : 0
}

export default function CouncilPage() {
  return (
    <div className="container mx-auto px-4 py-14">
      <FlowHeader
        title="Dispute Council"
        blurb="Cryptography narrows what needs judging — a confirmed event is already backed by independent newsletter proofs. Humans do the judging that's left: was the real world actually like that? Council members seated from BOTH communities can reverse a confirmed event, but only during its dispute window and only with a 75% supermajority of the full council."
      />
      <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-muted-foreground">
        Why this step exists: proofs can show that trusted newsletters <em>said</em> something
        happened — they can't show it was reported correctly. The council is the narrow human
        appeal layer between confirmation and settlement. Once an event is finalized on the{" "}
        <Link href="/pools" className="text-primary underline">
          pools
        </Link>{" "}
        page, it is beyond anyone's reach — courts before bailiffs, no retroactive reversals.
      </p>
      <JourneyBar current="/pools" />
      <HowReversalWorks />
      <ConnectGate>
        <CouncilInner />
      </ConnectGate>
      <HonestyNote>
        Fine print: council collusion is bounded by what the council can touch. It can only
        reverse <em>pending</em> events, only within the dispute window ({" "}
        <WindowMinutes /> minutes on this demo, 48 hours in the design), and a reversal merely
        returns the trigger slot — it cannot move tokens, seat members, or rewrite history. Seats
        are set by the timelocked governance owner; on this demo deployment that is the deployment
        admin.
      </HonestyNote>
    </div>
  )
}

/** Live dispute window read (works without a wallet), rendered as minutes. */
function WindowMinutes() {
  const reads = useReadContracts({
    contracts: [{ ...contract.engine(), functionName: "disputeWindow" }],
  })
  const secs = Number((reads.data?.[0]?.result as number | bigint | undefined) ?? 600)
  return <>{Math.round(secs / 60)}</>
}

/** Plain-language, no-wallet explainer of the reversal pipeline. */
function HowReversalWorks() {
  const reads = useReadContracts({
    contracts: [{ ...contract.engine(), functionName: "disputeWindow" }],
  })
  const windowSecs = Number((reads.data?.[0]?.result as number | bigint | undefined) ?? 600)
  const windowMin = Math.round(windowSecs / 60)

  const steps = [
    {
      icon: Timer,
      title: `1. Confirmed events wait ${windowMin} minutes`,
      body: `When enough independent newsletter proofs confirm an incentive, the engine queues a redistribution event — but nothing moves yet. The event sits in a ${windowMin}-minute dispute window (read live from the chain; 48 hours in the production design).`,
    },
    {
      icon: Scale,
      title: "2. The council can reverse — with 75% of everyone",
      body: "Council members — respected figures seated from both communities by the timelocked governance owner — each get one vote per event. Reversal needs yes from 75% of the FULL council, not 75% of whoever shows up. Silence counts against reversal.",
    },
    {
      icon: Gavel,
      title: "3. Reversal returns the slot; finalized is final",
      body: "A successful reversal cancels the event and returns the incentive's trigger slot, so a correct report can still confirm it later. Once the window passes and anyone finalizes, the event is beyond the council's reach — no retroactive reversals, ever.",
    },
  ]

  return (
    <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
      {steps.map((s) => (
        <Card key={s.title}>
          <CardContent className="space-y-2 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <s.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="font-display font-bold">{s.title}</div>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function CouncilInner() {
  const { address } = useAccount()

  // Council + engine metadata.
  const meta = useReadContracts({
    contracts: [
      { ...contract.council(), functionName: "memberCount" },
      {
        ...contract.council(),
        functionName: "isMember",
        args: address ? [address] : undefined,
      },
      { ...contract.engine(), functionName: "disputeWindow" },
      { ...contract.engine(), functionName: "eventCount" },
    ],
    query: { enabled: !!address },
  })
  const memberCount = Number((meta.data?.[0]?.result as bigint | undefined) ?? 0)
  const isMember = Boolean(meta.data?.[1]?.result)
  const disputeWindow = Number((meta.data?.[2]?.result as number | bigint | undefined) ?? 600)
  const eventCount = Number((meta.data?.[3]?.result as bigint | undefined) ?? 0)
  const threshold = thresholdOf(memberCount)

  // The docket: every event, positionally decoded.
  const eventIds = Array.from({ length: eventCount }, (_, i) => BigInt(i + 1))
  const eventReads = useReadContracts({
    contracts: eventIds.map((id) => ({
      address: contract.engine().address,
      abi: contract.engine().abi as Abi,
      functionName: "events",
      args: [id],
    })),
    query: { enabled: eventCount > 0 },
  })
  const events: Evt[] = eventIds
    .map((id, i) => {
      const r = eventReads.data?.[i]?.result as
        | readonly [bigint, bigint, number, bigint, bigint, number]
        | undefined
      if (!r) return undefined
      return {
        id,
        incentiveId: r[0],
        direction: Number(r[2]),
        planned: r[3],
        confirmedAt: Number(r[4]),
        status: Number(r[5]),
      }
    })
    .filter((e): e is Evt => !!e)

  const pending = events.filter((e) => e.status === 1)
  const reversedEvents = events.filter((e) => e.status === 3).reverse()

  const refetchAll = () => {
    meta.refetch()
    eventReads.refetch()
  }

  return (
    <div className="mx-auto mt-10 max-w-5xl space-y-6">
      {/* 2 — Roster */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Council roster
          </CardTitle>
          <CardDescription>
            Seats are granted and revoked only by the timelocked governance owner — neither
            community can pack the court unilaterally. On this demo deployment the council is
            seated by the deployment admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatPill
              label="Seated members"
              value={memberCount}
              hint="council.memberCount(), live from Gnosis"
            />
            <StatPill
              label="Reversal threshold"
              value={memberCount > 0 ? `${threshold} of ${memberCount}` : "—"}
              hint="Read it like this: 75% of every seat, not 75% of voters."
            />
            <StatPill
              label="Your seat"
              value={
                <Badge variant={isMember ? "default" : "outline"}>
                  {isMember ? "Council member" : "Not a member"}
                </Badge>
              }
              hint={`Connected as ${short(address)}`}
              tone={isMember ? "positive" : "default"}
            />
          </div>
          {!isMember && (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Your wallet holds no council seat, so the docket below is read-only for you. That's
              by design — judging is a scarce, accountable role, not an open faucet. Everything
              else on this page is public information anyone can verify.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3 + 4 — Pending docket with voting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" /> Pending events docket
          </CardTitle>
          <CardDescription>
            Every confirmed-but-not-final event, with its live countdown. While the clock runs,{" "}
            {threshold > 0 ? `${threshold} of ${memberCount}` : "75% of"} council votes reverse it;
            when the clock hits zero it becomes finalizable on the{" "}
            <Link href="/pools" className="text-primary underline">
              pools
            </Link>{" "}
            page and leaves the council's jurisdiction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The docket is empty — no events are inside a dispute window right now. Confirm an
              incentive on the{" "}
              <Link href="/attest" className="text-primary underline">
                attest
              </Link>{" "}
              flow to queue one.
            </p>
          ) : (
            pending.map((e) => (
              <DocketRow
                key={e.id.toString()}
                evt={e}
                disputeWindow={disputeWindow}
                memberCount={memberCount}
                threshold={threshold}
                isMember={isMember}
                onChanged={refetchAll}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* 5 — History of reversals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" /> Reversal history
          </CardTitle>
          <CardDescription>
            Events the council overturned. Each one returned its incentive's trigger slot, so the
            same incentive can still confirm later on a correct report. Finalized events never
            appear here — they are beyond reach.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {reversedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No reversals yet. That's the healthy default — the council is a brake, not a steering
              wheel.
            </p>
          ) : (
            reversedEvents.map((e) => <ReversedRow key={e.id.toString()} evt={e} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ------------------------------- docket row ------------------------------- */

function DocketRow({
  evt,
  disputeWindow,
  memberCount,
  threshold,
  isMember,
  onChanged,
}: {
  evt: Evt
  disputeWindow: number
  memberCount: number
  threshold: number
  isMember: boolean
  onChanged: () => void
}) {
  const { address } = useAccount()

  // Live clock for the countdown.
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  // Per-event council state.
  const reads = useReadContracts({
    contracts: [
      { ...contract.council(), functionName: "reverseVotes", args: [evt.id] },
      {
        ...contract.council(),
        functionName: "hasVoted",
        args: address ? [evt.id, address] : undefined,
      },
    ],
    query: { enabled: !!address },
  })
  const votes = Number((reads.data?.[0]?.result as bigint | undefined) ?? 0)
  const alreadyVoted = Boolean(reads.data?.[1]?.result)

  // Vote-to-reverse write, scoped to this row so its reads refetch cleanly.
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  useEffect(() => {
    if (receipt.isSuccess) {
      reads.refetch()
      onChanged()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess])

  const closesAt = evt.confirmedAt + disputeWindow
  const remaining = closesAt - now
  const windowOpen = remaining > 0
  const mm = Math.floor(Math.max(remaining, 0) / 60)
  const ss = Math.max(remaining, 0) % 60

  const vote = () =>
    writeContract({ ...contract.council(), functionName: "voteReverse", args: [evt.id] })

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">
            Event #{evt.id.toString()} · {DIRECTION_LABEL[evt.direction]}
          </div>
          <div className="text-xs text-muted-foreground">
            Incentive #{evt.incentiveId.toString()} · planned {fmt(evt.planned)} ·{" "}
            {windowOpen ? (
              <span>
                council can act for another{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {mm}:{ss.toString().padStart(2, "0")}
                </span>
              </span>
            ) : (
              <span className="text-amber-600">
                window closed — beyond the council's reach, awaiting finalize
              </span>
            )}
          </div>
        </div>
        {isMember ? (
          alreadyVoted ? (
            <Badge>You voted reverse</Badge>
          ) : (
            <TxButton
              size="sm"
              pending={isPending || receipt.isLoading}
              disabled={!windowOpen}
              onClick={vote}
            >
              Vote to reverse
            </TxButton>
          )
        ) : (
          <Badge variant="outline">Read-only — not a member</Badge>
        )}
      </div>

      {/* 6 — threshold visualization: one segment per seat, 75% line marked */}
      <ThresholdBar memberCount={memberCount} votes={votes} threshold={threshold} />

      <p className="text-xs text-muted-foreground">
        Read it like this: {votes} of {memberCount} seats have voted reverse; the reversal
        executes the moment vote number {threshold} lands (75% of the full council — abstaining
        seats count as no). The engine still checks the window is open and the event is pending.
      </p>

      {error && (
        <p className="text-sm text-destructive">
          {(error as { shortMessage?: string }).shortMessage || error.message}
        </p>
      )}
      {receipt.isSuccess && (
        <p className="rounded-lg bg-accent/40 p-3 text-sm text-accent-foreground">
          Vote recorded. If that pushed the tally past the threshold, the event is already
          reversed — check the history below. Next: watch remaining events here, or follow
          settlement on the{" "}
          <Link href="/pools" className="font-medium underline">
            pools
          </Link>{" "}
          page.
        </p>
      )}
    </div>
  )
}

/** One segment per council seat, filling as reverse votes land; 75% line marked. */
function ThresholdBar({
  memberCount,
  votes,
  threshold,
}: {
  memberCount: number
  votes: number
  threshold: number
}) {
  if (memberCount === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No council seated yet — with zero members, nothing can be reversed.
      </p>
    )
  }
  return (
    <div>
      <div className="relative pt-1">
        <div className="flex gap-1">
          {Array.from({ length: memberCount }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-3 flex-1 rounded-sm transition-colors",
                i < votes ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
        <div
          aria-hidden
          className="absolute -top-1 bottom-0 w-0.5 rounded bg-amber-500"
          style={{ left: "75%" }}
          title="75% supermajority line"
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {votes} / {memberCount} seats voted reverse
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> 75% line — needs{" "}
          {threshold}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------- history row ------------------------------- */

function ReversedRow({ evt }: { evt: Evt }) {
  const reads = useReadContracts({
    contracts: [
      { ...contract.council(), functionName: "reversed", args: [evt.id] },
      { ...contract.council(), functionName: "reverseVotes", args: [evt.id] },
    ],
  })
  const councilReversed = Boolean(reads.data?.[0]?.result)
  const finalVotes = Number((reads.data?.[1]?.result as bigint | undefined) ?? 0)

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-amber-500" />
        <div>
          <div className="font-medium">Event #{evt.id.toString()}</div>
          <div className="text-xs text-muted-foreground">
            {DIRECTION_LABEL[evt.direction]} · planned {fmt(evt.planned)} never moved ·{" "}
            {finalVotes} reverse votes
          </div>
        </div>
      </div>
      <Badge variant="outline">
        {councilReversed ? "Reversed by council vote" : "Reversed"}
      </Badge>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Coins, Gift, ShieldAlert, Timer, CheckCircle2, XCircle, Gavel } from "lucide-react"
import { ConnectGate, FlowHeader, TxButton, useMembership } from "@/components/flow"
import { contract } from "@/lib/contracts"
import { Community } from "@/lib/chains"
import { fmt, DIRECTION_LABEL } from "@/lib/format"

export default function PoolsPage() {
  return (
    <div className="container mx-auto px-4 py-14">
      <FlowHeader
        title="Peace Pools & Event Resolution"
        blurb="Every citizen mint stakes 10% into their community's peace pool corpus — capital consciously put at risk against their own side's aggression. Finalized harmful events slash that corpus into the other community's claimable rewards. Positive and joint events pay from the shared Treasury."
      />
      <ConnectGate>
        <PoolsInner />
      </ConnectGate>
    </div>
  )
}

const STATUS = ["None", "Pending", "Finalized", "Reversed"] as const

function PoolsInner() {
  const { address } = useAccount()
  const membership = useMembership()
  const myCommunity = membership.community

  // -------- Section 1: pool state for both communities --------
  const poolReads = useReadContracts({
    contracts: [
      { ...contract.poolA(), functionName: "corpusBalance" },
      { ...contract.poolB(), functionName: "corpusBalance" },
      {
        ...contract.poolA(),
        functionName: "claimable",
        args: address ? [address] : undefined,
      },
      {
        ...contract.poolB(),
        functionName: "claimable",
        args: address ? [address] : undefined,
      },
      {
        ...contract.tokenA(),
        functionName: "balanceOf",
        args: [contract.poolA().address],
      },
      {
        ...contract.tokenB(),
        functionName: "balanceOf",
        args: [contract.poolB().address],
      },
    ],
    query: { enabled: !!address },
  })

  const corpusA = poolReads.data?.[0]?.result as bigint | undefined
  const corpusB = poolReads.data?.[1]?.result as bigint | undefined
  const claimableA = poolReads.data?.[2]?.result as bigint | undefined
  const claimableB = poolReads.data?.[3]?.result as bigint | undefined
  const poolTokBalA = poolReads.data?.[4]?.result as bigint | undefined
  const poolTokBalB = poolReads.data?.[5]?.result as bigint | undefined

  // -------- Section 2: events --------
  const engineMeta = useReadContracts({
    contracts: [
      { ...contract.engine(), functionName: "eventCount" },
      { ...contract.engine(), functionName: "disputeWindow" },
    ],
  })
  const eventCount = Number((engineMeta.data?.[0]?.result as bigint | undefined) ?? 0n)
  const disputeWindow = Number((engineMeta.data?.[1]?.result as bigint | undefined) ?? 600n)

  const eventIds = Array.from({ length: eventCount }, (_, i) => BigInt(i + 1))
  const eventReads = useReadContracts({
    contracts: eventIds.map((id) => ({
      ...contract.engine(),
      functionName: "events" as const,
      args: [id] as const,
    })),
    query: { enabled: eventCount > 0 },
  })

  type Evt = {
    id: bigint
    incentiveId: bigint
    direction: number
    planned: bigint
    confirmedAt: number
    status: number
  }
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
  const history = events.filter((e) => e.status === 2 || e.status === 3).reverse()

  // -------- writes --------
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  useEffect(() => {
    if (receipt.isSuccess) {
      poolReads.refetch()
      engineMeta.refetch()
      eventReads.refetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess])

  const isCitizen = membership.isActiveMember && myCommunity !== Community.None
  const myClaimable = myCommunity === Community.A ? claimableA : myCommunity === Community.B ? claimableB : undefined

  const claim = () => {
    if (myCommunity === Community.None) return
    writeContract({ ...contract.pool(myCommunity), functionName: "claim" })
  }
  const finalize = (id: bigint) => {
    reset()
    writeContract({ ...contract.engine(), functionName: "finalize", args: [id] })
  }

  const txPending = isPending || receipt.isLoading

  return (
    <div className="mx-auto mt-10 max-w-5xl space-y-6">
      {/* Section 1 — pool state */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PoolCard
          label="Community A"
          corpus={corpusA}
          poolTokBal={poolTokBalA}
          claimable={claimableA}
          isMine={myCommunity === Community.A}
        />
        <PoolCard
          label="Community B"
          corpus={corpusB}
          poolTokBal={poolTokBalB}
          claimable={claimableB}
          isMine={myCommunity === Community.B}
        />
      </div>

      {/* Your claim */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" /> Your reward dividend
          </CardTitle>
          <CardDescription>
            Rewards are split equally per verified member of your pool (accumulator pattern), keyed
            to your identity nullifier so wallet rotation keeps unclaimed rewards.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCitizen ? (
            <>
              <div className="flex items-center justify-between rounded-lg bg-accent/40 p-4">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Claimable in {membership.communityLabel}
                  </div>
                  <div className="font-display text-2xl font-bold">
                    {fmt(myClaimable)}{" "}
                    <span className="text-base font-normal text-muted-foreground">
                      {myCommunity === Community.A ? "PEACE-A" : "PEACE-B"}
                    </span>
                  </div>
                </div>
                <TxButton
                  pending={txPending}
                  disabled={(myClaimable ?? 0n) === 0n}
                  onClick={claim}
                >
                  Claim
                </TxButton>
              </div>
              {(myClaimable ?? 0n) === 0n && (
                <p className="text-xs text-muted-foreground">
                  Nothing to claim yet — rewards accrue when a harmful event against the other side
                  is finalized, or when the Treasury pays out a positive/joint event to your pool.
                </p>
              )}
            </>
          ) : (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              You are not a verified citizen, so you have no pool membership.{" "}
              <a className="text-primary underline" href="/verify">
                Get verified
              </a>{" "}
              to earn and claim an equal share of your community pool.
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive">
              {(error as { shortMessage?: string }).shortMessage || error.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 2 — pending events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" /> Pending events
          </CardTitle>
          <CardDescription>
            Confirmed events wait out a {Math.round(disputeWindow / 60)}-minute dispute window (demo
            timing — 48h in production) during which the Dispute Council may reverse them. After it
            passes, anyone can finalize to move the value on-chain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {eventCount === 0 || pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pending events. Confirm an incentive over on the{" "}
              <a className="text-primary underline" href="/attest">
                attest
              </a>{" "}
              flow to queue one.
            </p>
          ) : (
            pending.map((e) => (
              <PendingRow
                key={e.id.toString()}
                evt={e}
                disputeWindow={disputeWindow}
                onFinalize={() => finalize(e.id)}
                pending={txPending}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" /> Resolution history
          </CardTitle>
          <CardDescription>Finalized and reversed events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resolved events yet.</p>
          ) : (
            history.map((e) => (
              <div
                key={e.id.toString()}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  {e.status === 2 ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <XCircle className="h-4 w-4 text-amber-500" />
                  )}
                  <div>
                    <div className="font-medium">Event #{e.id.toString()}</div>
                    <div className="text-xs text-muted-foreground">
                      {DIRECTION_LABEL[e.direction]} · planned {fmt(e.planned)}
                    </div>
                  </div>
                </div>
                <Badge variant={e.status === 2 ? "default" : "outline"}>{STATUS[e.status]}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Section 3 — explainer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" /> How resolution works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Harmful events</span> slash the
            responsible community's pool corpus and route it — redeemed to reserve and re-minted at
            par — into the <em>other</em> community's claimable rewards. Aggression by your side
            pays the side it harmed.
          </p>
          <p>
            <span className="font-medium text-foreground">Positive events</span> pay the rewarded
            pool from the shared Treasury; <span className="font-medium text-foreground">joint</span>{" "}
            cooperation splits a Treasury payout 50/50 into both pools.
          </p>
          <p>
            Claims are <span className="font-medium text-foreground">equal per member</span> — every
            verified citizen of a pool draws the same share, regardless of how much they minted.
          </p>
          <p className="rounded-lg bg-muted p-3 text-foreground">
            Note: on this demo deployment the dispute window is{" "}
            <span className="font-medium">10 minutes</span>, not 48 hours — so an event confirmed now
            is finalizable shortly after.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function PoolCard({
  label,
  corpus,
  poolTokBal,
  claimable,
  isMine,
}: {
  label: string
  corpus: bigint | undefined
  poolTokBal: bigint | undefined
  claimable: bigint | undefined
  isMine: boolean
}) {
  return (
    <Card className={isMine ? "border-primary/60" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" /> {label} pool
          </span>
          {isMine && <Badge>Your pool</Badge>}
        </CardTitle>
        <CardDescription>Corpus is at-risk stake; rewards are claimable.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row label="Corpus (at-risk stake)" value={fmt(corpus)} />
        <Row label="Pool token balance" value={fmt(poolTokBal)} />
        <Row label="Your claimable" value={fmt(claimable)} />
      </CardContent>
    </Card>
  )
}

function PendingRow({
  evt,
  disputeWindow,
  onFinalize,
  pending,
}: {
  evt: { id: bigint; incentiveId: bigint; direction: number; planned: bigint; confirmedAt: number }
  disputeWindow: number
  onFinalize: () => void
  pending: boolean
}) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  // Read the incentive to get the authoritative direction label.
  const inc = useReadContracts({
    contracts: [
      { ...contract.incentive(), functionName: "getIncentive", args: [evt.incentiveId] },
    ],
  })
  const incView = inc.data?.[0]?.result as { direction: number } | undefined
  const direction = incView ? Number(incView.direction) : evt.direction

  const readyAt = evt.confirmedAt + disputeWindow
  const remaining = readyAt - now
  const ready = remaining <= 0

  const mm = Math.floor(Math.max(remaining, 0) / 60)
  const ss = Math.max(remaining, 0) % 60

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="space-y-0.5">
        <div className="text-sm font-medium">
          Event #{evt.id.toString()} · {DIRECTION_LABEL[direction]}
        </div>
        <div className="text-xs text-muted-foreground">
          Planned {fmt(evt.planned)} ·{" "}
          {ready ? (
            <span className="text-primary">dispute window closed</span>
          ) : (
            <span>
              finalizable in {mm}:{ss.toString().padStart(2, "0")}
            </span>
          )}
        </div>
      </div>
      <TxButton size="sm" pending={pending} disabled={!ready} onClick={onFinalize}>
        Finalize
      </TxButton>
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

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi"
import { parseUnits } from "viem"
import {
  HandCoins,
  Binoculars,
  LockSimpleOpen,
  ArrowCounterClockwise,
  LockSimple,
} from "@phosphor-icons/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Landmark, ListChecks, PiggyBank, Timer, CheckCircle2, Undo2 } from "lucide-react"
import { ConnectGate, FlowHeader, TxButton, useTxSteps } from "@/components/flow"
import {
  StepperExplainer,
  HonestyNote,
  PrereqNote,
  type ExplainerStep,
} from "@/components/explainer"
import { VisualFrame, VizWorld } from "@/components/journey-visuals"
import { contract } from "@/lib/contracts"
import { fmt, short } from "@/lib/format"
import { cn } from "@/lib/utils"

/* ----------------------------- domain helpers ----------------------------- */

const BENEFICIARY_LABEL: Record<number, string> = {
  0: "Peace pool A",
  1: "Peace pool B",
  2: "Both pools (50/50)",
  3: "Shared Treasury",
}

/** Positional tuple from the public `tranches(uint256)` mapping getter. */
type TrancheTuple = readonly [
  `0x${string}`, // donor
  bigint, // incentiveId
  number, // beneficiary
  bigint, // amount
  bigint, // expiry (uint64)
  boolean, // released
  boolean, // reclaimed
]

interface Tranche {
  id: bigint
  donor: `0x${string}`
  incentiveId: bigint
  beneficiary: number
  amount: bigint
  expiry: number
  released: boolean
  reclaimed: boolean
}

type TrancheStatus = "Active" | "Released" | "Reclaimed" | "Expired — unclaimed"

function statusOf(t: Tranche, now: number): TrancheStatus {
  if (t.released) return "Released"
  if (t.reclaimed) return "Reclaimed"
  if (now > t.expiry) return "Expired — unclaimed"
  return "Active"
}

function countdown(seconds: number): string {
  if (seconds <= 0) return "expired"
  if (seconds >= 86400) {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    return `${d}d ${h}h left`
  }
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m left`
  }
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")} left`
}

/* --------------------------- explainer + diagram --------------------------- */

const STEPS: ExplainerStep[] = [
  {
    key: "escrow",
    short: "Escrow",
    title: "Lock money against one specific promise",
    body: "A donor — a state, an NGO, a diaspora fund — deposits reserve dollars against a single agreed incentive: “if this de-escalation is reported by both sides' press plus international wires, this money flows.” The incentive, the beneficiary, and the expiry date are all fixed forever at deposit time. Nobody — not even the donor — can quietly move the goalposts afterward.",
    chip: "Conditions are immutable at deposit",
    icon: HandCoins,
  },
  {
    key: "watch",
    short: "Watch",
    title: "The chain watches the news, not a diplomat",
    body: "The tranche just sits there, in public, waiting. The only key that fits its lock is a finalized event of that exact incentive — the same newsletter-proof pipeline the peace pools use: attestations from both communities and international press, then a public-notice window before anything moves. No committee meets to decide whether conditions were 'really' met.",
    chip: "Same evidence pipeline as the peace pools",
    icon: Binoculars,
  },
  {
    key: "release",
    short: "Release",
    title: "Anyone can pull the trigger",
    body: "Once an event of the tranche's incentive is finalized, release is permissionless — any wallet on earth can point the tranche at the event and the funds move: at par into pool rewards (every backed token stays backed) or straight to the shared Treasury. Beneficiaries never need the donor's signature, goodwill, or continued attention.",
    chip: "Beneficiaries never need the donor's permission",
    icon: LockSimpleOpen,
  },
  {
    key: "reclaim",
    short: "Reclaim",
    title: "No event by expiry? The money goes home",
    body: "If the incentive never produces a finalized event before the expiry the donor chose, the donor — and only the donor — reclaims the full amount. Donors risk time, not principal, which makes committing real money to peace outcomes far cheaper than writing a blank check.",
    chip: "Donors risk time, not principal",
    icon: ArrowCounterClockwise,
  },
]

function DiagramBox({
  active,
  className,
  children,
}: {
  active: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-3 text-center transition-all duration-500",
        active ? "border-primary shadow-lg" : "border-border opacity-75",
        className,
      )}
    >
      {children}
    </div>
  )
}

function EscrowDiagram({ step }: { step: string }) {
  const hl = (keys: string[]) => keys.includes(step)
  return (
    <div className="bg-gradient-to-b from-accent/20 to-transparent p-5 sm:p-8">
      <div className="flex items-center gap-2 sm:gap-4">
        {/* donor */}
        <DiagramBox active={hl(["escrow", "reclaim"])} className="w-24 flex-none sm:w-36">
          <HandCoins size={22} weight="bold" className="mx-auto text-primary" />
          <div className="mt-1 text-[11px] font-semibold leading-tight">donor</div>
          <div className="text-[10px] leading-tight text-muted-foreground">
            state · NGO · diaspora
          </div>
        </DiagramBox>

        {/* deposit / reclaim arrows */}
        <div className="flex w-14 flex-none flex-col items-center text-[9px] text-muted-foreground sm:w-20">
          <span
            aria-hidden
            className={cn(
              "text-xl leading-none text-primary transition-opacity duration-500",
              hl(["escrow"]) ? "opacity-100" : "opacity-30",
            )}
          >
            ⇢
          </span>
          <span className={cn("transition-opacity", hl(["escrow"]) ? "font-semibold text-foreground opacity-100" : "opacity-50")}>
            deposit
          </span>
          <span
            aria-hidden
            className={cn(
              "mt-1 text-xl leading-none text-primary transition-opacity duration-500",
              hl(["reclaim"]) ? "opacity-100" : "opacity-30",
            )}
          >
            ⇠
          </span>
          <span className={cn("transition-opacity", hl(["reclaim"]) ? "font-semibold text-foreground opacity-100" : "opacity-50")}>
            reclaim after expiry
          </span>
        </div>

        {/* tranche */}
        <DiagramBox active={hl(["escrow", "watch"])} className="flex-1">
          <LockSimple
            size={22}
            weight="bold"
            className={cn("mx-auto transition-colors duration-500", hl(["release"]) ? "text-muted-foreground" : "text-primary")}
          />
          <div className="mt-1 text-[11px] font-semibold leading-tight">escrowed tranche</div>
          <div className="text-[10px] leading-tight text-muted-foreground">
            incentive · beneficiary · expiry — fixed at deposit
          </div>
          <div
            className={cn(
              "mx-auto mt-2 max-w-[180px] rounded-lg px-2 py-1 text-[9px] font-medium transition-all duration-500",
              hl(["watch"])
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            unlocks only on a finalized event of its incentive
          </div>
        </DiagramBox>

        {/* release arrow */}
        <div className="flex w-14 flex-none flex-col items-center text-[9px] text-muted-foreground sm:w-20">
          <span
            aria-hidden
            className={cn(
              "text-xl leading-none text-primary transition-opacity duration-500",
              hl(["release"]) ? "opacity-100" : "opacity-30",
            )}
          >
            ⇉
          </span>
          <span className={cn("transition-opacity", hl(["release"]) ? "font-semibold text-foreground opacity-100" : "opacity-50")}>
            release (anyone)
          </span>
        </div>

        {/* beneficiaries */}
        <div className="flex w-28 flex-none flex-col gap-1.5 sm:w-40">
          {["peace pool A rewards", "peace pool B rewards", "shared Treasury"].map((label) => (
            <div
              key={label}
              className={cn(
                "rounded-xl border-2 px-2 py-1.5 text-center text-[10px] font-semibold leading-tight transition-all duration-500",
                hl(["release"]) ? "border-primary shadow-lg" : "border-border opacity-70",
              )}
            >
              {label}
            </div>
          ))}
          <div className="text-center text-[9px] text-muted-foreground">
            through the reserve — backing holds
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------- page --------------------------------- */

export default function EscrowPage() {
  return (
    <div className="container mx-auto px-4 py-14">
      <FlowHeader
        title="Sanctions Relief, Pre-Committed"
        blurb="Traditional sanctions punish whole populations and let the goalposts drift with politics. Escrowed relief flips that: a donor locks funds against one specific, pre-agreed incentive — a finalized event releases them automatically, and if it never happens, the donor takes the money back."
      />
      <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-muted-foreground">
        This page exists for outside parties who want peace outcomes but don't trust
        intermediaries: everything a tranche will ever do is visible and immutable the moment it's
        deposited — targeted, transparent, automatic.
      </p>

      <div className="mx-auto max-w-5xl">
        <StepperExplainer steps={STEPS} diagram={(k) => <EscrowDiagram step={k} />} />
      </div>

      <div className="mx-auto mt-8 max-w-xl">
        <VisualFrame caption="support flows in — the say stays with the two communities">
          <VizWorld />
        </VisualFrame>
      </div>
      <ConnectGate>
        <EscrowInner />
      </ConnectGate>

      <HonestyNote>
        Release is permissionless and race-free against reclaim: a finalized event is public for
        the whole dispute window (10 minutes on this demo, 48 hours in production) before any
        reclaim could front-run it, so beneficiaries always have time to act first. Released funds
        enter pool rewards through the reserve — every unit stays fully backed.
        This is a demo on test funds; nothing here is financial or sanctions-policy advice.
      </HonestyNote>
    </div>
  )
}

/* ------------------------------- inner flow ------------------------------- */

const EXPIRY_PRESETS = [
  { label: "1 day", seconds: 86400n },
  { label: "7 days", seconds: 7n * 86400n },
  { label: "30 days", seconds: 30n * 86400n },
] as const

interface ProposalStateView {
  createdAt: bigint
  active: boolean
  finalized: boolean
  passed: boolean
  descriptionURI: string
}

interface Evt {
  id: bigint
  incentiveId: bigint
  status: number
}

function EscrowInner() {
  const { address } = useAccount()
  const escrow = contract.escrow()

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  /* -------- tranche list -------- */
  const trancheCount = useReadContract({ ...escrow, functionName: "trancheCount" })
  const total = Number((trancheCount.data as bigint | undefined) ?? 0n)
  const trancheIds = Array.from({ length: total }, (_, i) => BigInt(i + 1))
  const trancheReads = useReadContracts({
    contracts: trancheIds.map((id) => ({
      ...escrow,
      functionName: "tranches" as const,
      args: [id] as const,
    })),
    query: { enabled: total > 0 },
  })
  const tranches: Tranche[] = trancheIds
    .map((id, i) => {
      const r = trancheReads.data?.[i]?.result as TrancheTuple | undefined
      if (!r) return undefined
      return {
        id,
        donor: r[0],
        incentiveId: r[1],
        beneficiary: Number(r[2]),
        amount: r[3],
        expiry: Number(r[4]),
        released: r[5],
        reclaimed: r[6],
      }
    })
    .filter((t): t is Tranche => !!t)

  /* -------- incentives (for deposit picker + labels) -------- */
  const incCount = useReadContract({ ...contract.incentive(), functionName: "incentiveCount" })
  const incTotal = Number((incCount.data as bigint | undefined) ?? 0n)
  const incReads = useReadContracts({
    contracts: Array.from({ length: incTotal }, (_, i) => ({
      ...contract.incentive(),
      functionName: "proposalState" as const,
      args: [BigInt(i + 1)] as const,
    })),
    query: { enabled: incTotal > 0 },
  })
  const incentives = useMemo(() => {
    if (!incReads.data) return []
    return incReads.data
      .map((r, i) => ({ id: BigInt(i + 1), state: r.result as ProposalStateView | undefined }))
      .filter(
        (x): x is { id: bigint; state: ProposalStateView } =>
          !!x.state && x.state.createdAt > 0n,
      )
  }, [incReads.data])
  const incentiveById = useMemo(() => {
    const m = new Map<string, ProposalStateView>()
    for (const i of incentives) m.set(i.id.toString(), i.state)
    return m
  }, [incentives])

  /* -------- finalized events (for release) -------- */
  const evtCount = useReadContract({ ...contract.engine(), functionName: "eventCount" })
  const evtTotal = Number((evtCount.data as bigint | undefined) ?? 0n)
  const evtReads = useReadContracts({
    contracts: Array.from({ length: evtTotal }, (_, i) => ({
      ...contract.engine(),
      functionName: "events" as const,
      args: [BigInt(i + 1)] as const,
    })),
    query: { enabled: evtTotal > 0 },
  })
  // status enum: 0 None, 1 Pending, 2 Finalized, 3 Reversed
  const finalizedEvents: Evt[] = Array.from({ length: evtTotal }, (_, i) => {
    const r = evtReads.data?.[i]?.result as
      | readonly [bigint, bigint, number, bigint, bigint, number]
      | undefined
    if (!r) return undefined
    return { id: BigInt(i + 1), incentiveId: r[0], status: Number(r[5]) }
  })
    .filter((e): e is Evt => !!e && e.status === 2)

  /* -------- balances / allowance -------- */
  const usdBal = useReadContract({
    ...contract.reserve(),
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
  const allowance = useReadContract({
    ...contract.reserve(),
    functionName: "allowance",
    args: address ? [address, escrow.address] : undefined,
    query: { enabled: !!address },
  })

  /* -------- writes -------- */
  const refetchAll = useCallback(() => {
    trancheCount.refetch()
    trancheReads.refetch()
    usdBal.refetch()
    allowance.refetch()
    evtCount.refetch()
    evtReads.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // release + reclaim are single txs (no approval) — keep on useWriteContract.
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  const [lastAction, setLastAction] = useState<"release" | "reclaim" | null>(null)
  useEffect(() => {
    if (receipt.isSuccess) refetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess])
  const txPending = isPending || receipt.isLoading
  // deposit is "approve-if-needed → deposit" as ONE gesture.
  const depositSteps = useTxSteps(refetchAll)

  /* -------- deposit form state -------- */
  const [incentiveId, setIncentiveId] = useState("")
  const [beneficiary, setBeneficiary] = useState("0")
  const [amount, setAmount] = useState("100")
  const [expiryPreset, setExpiryPreset] = useState<(typeof EXPIRY_PRESETS)[number]["seconds"]>(
    EXPIRY_PRESETS[1].seconds,
  )
  const amountWei = (() => {
    try {
      return parseUnits(amount || "0", 18)
    } catch {
      return 0n
    }
  })()
  const needsApproval = ((allowance.data as bigint | undefined) ?? 0n) < amountWei
  const hasUsd = ((usdBal.data as bigint | undefined) ?? 0n) > 0n
  const chosenIncentive = incentiveId ? incentiveById.get(incentiveId) : undefined

  // One gesture: approve the reserve to the escrow (if short), then deposit.
  const doDeposit = () => {
    reset()
    setLastAction(null)
    const expiry = BigInt(Math.floor(Date.now() / 1000)) + expiryPreset
    depositSteps.run([
      {
        label: `Approve ${amount || "0"} sDAI`,
        request: () =>
          needsApproval
            ? {
                ...contract.reserve(),
                functionName: "approve",
                args: [escrow.address, amountWei],
              }
            : null,
      },
      {
        label: `Escrow ${amount || "0"} sDAI`,
        request: () => ({
          ...escrow,
          functionName: "deposit",
          args: [BigInt(incentiveId), Number(beneficiary), amountWei, expiry],
        }),
      },
    ])
  }
  const release = (trancheId: bigint, eventId: bigint) => {
    reset()
    setLastAction("release")
    writeContract({ ...escrow, functionName: "release", args: [trancheId, eventId] })
  }
  const reclaim = (trancheId: bigint) => {
    reset()
    setLastAction("reclaim")
    writeContract({ ...escrow, functionName: "reclaim", args: [trancheId] })
  }

  return (
    <div className="mx-auto mt-10 max-w-5xl space-y-6">
      <PrereqNote met={hasUsd} href="/mint" cta="Get test sDAI">
        Escrow deposits are made in sDAI, the demo reserve asset — your balance is zero. Grab
        sDAI first — swap xDAI on CoW (link on the mint page).
      </PrereqNote>

      {/* -------- deposit -------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-primary" /> Escrow a new tranche
          </CardTitle>
          <CardDescription>
            Pick the one incentive your money is conditioned on, who receives it, and how long
            you're willing to wait. All three are locked forever the moment you deposit — that's
            the point.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Incentive (the condition)</label>
            <select
              value={incentiveId}
              onChange={(e) => setIncentiveId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">— choose an incentive —</option>
              {incentives.map(({ id, state }) => (
                <option key={id.toString()} value={id.toString()}>
                  #{id.toString()} · {state.descriptionURI || "(no description)"}
                  {state.active ? " · active" : state.finalized ? " · not active" : " · still in governance"}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Your tranche only ever releases on a <span className="font-medium text-foreground">finalized event of this exact incentive</span> —
              confirmed by newsletter proofs, survived the dispute window. If the incentive never
              triggers, you reclaim.
            </p>
            {chosenIncentive && !chosenIncentive.active && (
              <p className="mt-1 rounded-lg bg-amber-500/10 p-2 text-xs text-muted-foreground">
                Heads up: this incentive is not currently active, so it cannot produce new events
                right now. You can still escrow against it — but expect to reclaim unless it
                (re)activates and triggers before your expiry.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Beneficiary</label>
              <select
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {[0, 1, 2, 3].map((b) => (
                  <option key={b} value={b}>
                    {BENEFICIARY_LABEL[b]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Pool beneficiaries receive rewards minted at par — split equally per verified
                member. Treasury funds positive & joint-action payouts.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Amount (sDAI)</label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Your balance: {fmt(usdBal.data as bigint | undefined)} sDAI
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Expiry (your reclaim date)</label>
            <div className="flex gap-2">
              {EXPIRY_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setExpiryPreset(p.seconds)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    expiryPreset === p.seconds
                      ? "border-primary bg-accent/40 font-semibold"
                      : "border-border text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Read it like this: “if no finalized event happens within{" "}
              {EXPIRY_PRESETS.find((p) => p.seconds === expiryPreset)?.label}, I get my money
              back.” Until then it's locked — release beats reclaim.
            </p>
          </div>

          <TxButton
            className="w-full"
            pending={depositSteps.running}
            disabled={amountWei === 0n || !incentiveId}
            onClick={doDeposit}
          >
            {depositSteps.running
              ? depositSteps.stepLabel || "Working…"
              : needsApproval
                ? `Escrow ${amount || "0"} sDAI — approve + deposit in one click`
                : `Escrow ${amount || "0"} sDAI against incentive #${incentiveId || "—"}`}
          </TxButton>

          {depositSteps.done && (
            <p className="text-sm text-primary">
              Tranche escrowed. It now appears in the list below — watch{" "}
              <a className="underline" href="/attest">
                attestations
              </a>{" "}
              and{" "}
              <a className="underline" href="/pools">
                event resolution
              </a>{" "}
              to see when it can release.
            </p>
          )}
          {depositSteps.error && (
            <p className="text-sm text-destructive">{depositSteps.error}</p>
          )}
        </CardContent>
      </Card>

      {/* -------- tranche list -------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" /> All tranches
          </CardTitle>
          <CardDescription>
            Every escrowed commitment, live from chain. Anyone can release an open tranche once a
            matching event finalizes; only the donor can reclaim after expiry.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {total === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tranches yet — be the first donor above.
            </p>
          ) : (
            tranches
              .slice()
              .reverse()
              .map((t) => (
                <TrancheRow
                  key={t.id.toString()}
                  tranche={t}
                  now={now}
                  me={address}
                  incentive={incentiveById.get(t.incentiveId.toString())}
                  matchingEvents={finalizedEvents.filter((e) => e.incentiveId === t.incentiveId)}
                  onRelease={release}
                  onReclaim={reclaim}
                  txPending={txPending}
                />
              ))
          )}
          {receipt.isSuccess && lastAction === "release" && (
            <p className="text-sm text-primary">
              Released. Funds are now in the beneficiary — pool members can head to{" "}
              <a className="underline" href="/pools">
                the pools page
              </a>{" "}
              to claim their dividend.
            </p>
          )}
          {receipt.isSuccess && lastAction === "reclaim" && (
            <p className="text-sm text-primary">Reclaimed — the sDAI is back in your wallet.</p>
          )}
          {error && (
            <p className="text-sm text-destructive">
              {(error as { shortMessage?: string }).shortMessage || error.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* -------- plain-language mechanics -------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" /> Why this beats classic sanctions relief
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Targeted:</span> money is conditioned on
            one specific incentive both communities already voted for — not on a whole country's
            behavior, so ordinary people aren't collateral damage.
          </p>
          <p>
            <span className="font-medium text-foreground">Transparent:</span> the condition, the
            beneficiary, the amount and the deadline are all on-chain from day one. Nobody can
            claim conditions were met (or unmet) in a back room.
          </p>
          <p>
            <span className="font-medium text-foreground">Automatic:</span> release requires no
            signature from the donor and no committee vote — a finalized event is the whole
            unlock. The donor's later change of heart cannot claw back a promise the evidence
            already earned.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/* ------------------------------- tranche row ------------------------------- */

function TrancheRow({
  tranche: t,
  now,
  me,
  incentive,
  matchingEvents,
  onRelease,
  onReclaim,
  txPending,
}: {
  tranche: Tranche
  now: number
  me: `0x${string}` | undefined
  incentive: ProposalStateView | undefined
  matchingEvents: Evt[]
  onRelease: (trancheId: bigint, eventId: bigint) => void
  onReclaim: (trancheId: bigint) => void
  txPending: boolean
}) {
  const status = statusOf(t, now)
  const open = status === "Active" || status === "Expired — unclaimed"
  const isDonor = !!me && me.toLowerCase() === t.donor.toLowerCase()
  const canReclaim = isDonor && open && now > t.expiry
  const [eventId, setEventId] = useState("")
  const chosenEvent = eventId || matchingEvents[0]?.id.toString() || ""

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            Tranche #{t.id.toString()}
            <StatusBadge status={status} />
            {isDonor && <Badge variant="outline">Your deposit</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">
            {fmt(t.amount)} sDAI → {BENEFICIARY_LABEL[t.beneficiary]} · conditioned on incentive #
            {t.incentiveId.toString()}
            {incentive?.descriptionURI ? ` (“${incentive.descriptionURI}”)` : ""} · donor{" "}
            {short(t.donor)}
          </div>
          <div className="text-xs text-muted-foreground">
            {status === "Active" && (
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3 w-3" /> expiry: {countdown(t.expiry - now)}
              </span>
            )}
            {status === "Expired — unclaimed" &&
              "expired — donor may reclaim, but a finalized event can still release it until they do"}
            {status === "Released" && (
              <span className="inline-flex items-center gap-1 text-primary">
                <CheckCircle2 className="h-3 w-3" /> released to {BENEFICIARY_LABEL[t.beneficiary]}
              </span>
            )}
            {status === "Reclaimed" && (
              <span className="inline-flex items-center gap-1">
                <Undo2 className="h-3 w-3" /> reclaimed by donor
              </span>
            )}
          </div>
        </div>

        {open && (
          <div className="flex flex-wrap items-center gap-2">
            {matchingEvents.length > 0 ? (
              <>
                <select
                  value={chosenEvent}
                  onChange={(e) => setEventId(e.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                >
                  {matchingEvents.map((e) => (
                    <option key={e.id.toString()} value={e.id.toString()}>
                      Finalized event #{e.id.toString()}
                    </option>
                  ))}
                </select>
                <TxButton
                  size="sm"
                  pending={txPending}
                  onClick={() => onRelease(t.id, BigInt(chosenEvent))}
                >
                  Release
                </TxButton>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                no finalized event of this incentive yet
              </span>
            )}
            {canReclaim && (
              <TxButton
                size="sm"
                variant="outline"
                pending={txPending}
                onClick={() => onReclaim(t.id)}
              >
                Reclaim
              </TxButton>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: TrancheStatus }) {
  if (status === "Active") return <Badge>Active</Badge>
  if (status === "Released") return <Badge variant="secondary">Released</Badge>
  if (status === "Reclaimed") return <Badge variant="outline">Reclaimed</Badge>
  return (
    <Badge variant="outline" className="border-amber-500/60 text-amber-600">
      Expired — unclaimed
    </Badge>
  )
}

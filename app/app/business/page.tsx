"use client"

import { useState } from "react"
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseUnits } from "viem"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { Store, Vote, HandCoins, FilePlus2, ThumbsUp, ThumbsDown, Gavel, ArrowRight } from "lucide-react"
import { ConnectGate, FlowHeader, TxButton, useMembership } from "@/components/flow"
import { HonestyNote, PrereqNote } from "@/components/explainer"
import { VisualFrame, VizYearOne } from "@/components/journey-visuals"
import { contract } from "@/lib/contracts"
import { Community } from "@/lib/chains"
import { fmt, short, COMMUNITY_LABEL } from "@/lib/format"

const businessContract = contract.business()

// BusinessRegistry.BizStatus enum.
const STATUS = {
  None: 0,
  CertVote: 1,
  Certified: 2,
  Rejected: 3,
  RevokeVote: 4,
  Revoked: 5,
} as const

const STATUS_META: Record<number, { label: string; variant: "default" | "outline" | "secondary" | "destructive" }> = {
  0: { label: "None", variant: "outline" },
  1: { label: "Certification poll", variant: "secondary" },
  2: { label: "Certified", variant: "default" },
  3: { label: "Rejected", variant: "destructive" },
  4: { label: "Revocation poll", variant: "secondary" },
  5: { label: "Revoked", variant: "destructive" },
}

/** Tuple returned by businesses(id). */
type Biz = readonly [
  `0x${string}`, // wallet
  number, // community
  string, // metadataURI
  number, // status
  bigint, // votingEnd
  bigint, // session
  bigint, // yesA
  bigint, // noA
  bigint, // yesB
  bigint, // noB
]

const isPoll = (s: number) => s === STATUS.CertVote || s === STATUS.RevokeVote

export default function BusinessPage() {
  return (
    <div className="container mx-auto px-4 py-14">
      <FlowHeader
        title="Peace-Abiding Businesses"
        blurb="Businesses earn certification through a one-member-one-vote poll that needs a majority in BOTH communities. Pay a certified business across the conflict line and the Treasury tops it up with a cooperation bonus."
      />
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
        This page sits <em>alongside</em> the main verify → join → agree → attest → settle
        journey rather than on it: pools punish harm after the fact, while certified businesses
        reward everyday cooperation as it happens. Why it exists: peace that only pays out when
        something goes wrong is half a peace — cross-line commerce is the other half.
      </p>
      <div className="mx-auto mt-8 max-w-xl">
        <VisualFrame caption="every purchase keeps value with neighbors">
          <VizYearOne />
        </VisualFrame>
      </div>
      <ConnectGate>
        <BusinessInner />
      </ConnectGate>
      <HonestyNote>
        Honest limit: the cooperation bonus is best-effort and budgeted per epoch precisely so it
        cannot be farmed — two colluding wallets ping-ponging payments would drain a fixed budget,
        not an open tap, and oversized bonuses get trimmed to whatever budget remains. Dual-majority
        certification (and revocation by the same rule) is the other anti-abuse gate.
      </HonestyNote>
    </div>
  )
}

function BusinessInner() {
  const membership = useMembership()
  const isMember = membership.isActiveMember && membership.community !== Community.None

  const count = useReadContract({
    ...businessContract,
    functionName: "businessCount",
  })
  const period = useReadContract({
    ...businessContract,
    functionName: "votingPeriod",
  })
  const bonusBps = useReadContract({
    ...businessContract,
    functionName: "cooperationBonusBps",
  })

  const n = Number(count.data ?? 0n)
  const list = useReadContracts({
    contracts: Array.from({ length: n }, (_, i) => ({
      ...businessContract,
      functionName: "businesses" as const,
      args: [BigInt(i + 1)] as const,
    })),
    query: { enabled: n > 0 },
  })

  const refetchAll = () => {
    count.refetch()
    list.refetch()
  }

  const businesses: { id: number; biz: Biz }[] = (list.data ?? [])
    .map((r, i) => ({ id: i + 1, biz: r.result as Biz | undefined }))
    .filter((x): x is { id: number; biz: Biz } => Array.isArray(x.biz))

  const periodSecs = Number(period.data ?? 0)
  const periodLabel = periodSecs
    ? periodSecs % 86400 === 0
      ? `${periodSecs / 86400} day${periodSecs / 86400 === 1 ? "" : "s"}`
      : `${Math.round(periodSecs / 60)} min`
    : "…"

  return (
    <div className="mx-auto mt-10 max-w-4xl">
      <PrereqNote met={isMember} href="/verify" cta="Verify">
        You can browse the directory, but voting on certifications and paying businesses need a
        verified membership — the dual-majority rule only works if each voter is one person.
      </PrereqNote>

      <Tabs defaultValue="directory" className="mt-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="apply">Apply</TabsTrigger>
          <TabsTrigger value="vote">Vote</TabsTrigger>
          <TabsTrigger value="pay">Pay</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------ DIRECTORY */}
        <TabsContent value="directory" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {n} registered business{n === 1 ? "" : "es"}. Polls run for {periodLabel} on this
            deployment.
          </p>
          {n === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No businesses yet. Be the first to apply for certification.
              </CardContent>
            </Card>
          )}
          {businesses.map(({ id, biz }) => (
            <BizCard key={id} id={id} biz={biz} />
          ))}
        </TabsContent>

        {/* ---------------------------------------------------------- APPLY */}
        <TabsContent value="apply" className="mt-6">
          <ApplyCard onDone={refetchAll} />
        </TabsContent>

        {/* ----------------------------------------------------------- VOTE */}
        <TabsContent value="vote" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Verified members cast one vote per poll; a poll passes only with a majority in both
            Community A and Community B. After the {periodLabel} window closes anyone can finalize.
          </p>
          {businesses.filter(({ biz }) => isPoll(biz[3]) || biz[3] === STATUS.Certified).length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No open polls or certified businesses right now.
              </CardContent>
            </Card>
          )}
          {businesses
            .filter(({ biz }) => isPoll(biz[3]) || biz[3] === STATUS.Certified)
            .map(({ id, biz }) => (
              <VoteCard key={id} id={id} biz={biz} isMember={isMember} onDone={refetchAll} />
            ))}
        </TabsContent>

        {/* ------------------------------------------------------------ PAY */}
        <TabsContent value="pay" className="mt-6 space-y-4">
          <PayIntro bonusBps={Number(bonusBps.data ?? 0n)} membership={membership} />
          {businesses.filter(({ biz }) => biz[3] === STATUS.Certified).length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No certified businesses to pay yet.
              </CardContent>
            </Card>
          )}
          {businesses
            .filter(({ biz }) => biz[3] === STATUS.Certified)
            .map(({ id, biz }) => (
              <PayCard key={id} id={id} biz={biz} isMember={isMember} membership={membership} onDone={refetchAll} />
            ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// -------------------------------------------------------------------- pieces

function Tally({ biz }: { biz: Biz }) {
  const [, , , , , , yesA, noA, yesB, noB] = biz
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div className="rounded-lg bg-muted p-2">
        <div className="text-muted-foreground">Community A</div>
        <div className="font-medium">
          <span className="text-primary">{Number(yesA)} yes</span> · {Number(noA)} no
        </div>
      </div>
      <div className="rounded-lg bg-muted p-2">
        <div className="text-muted-foreground">Community B</div>
        <div className="font-medium">
          <span className="text-primary">{Number(yesB)} yes</span> · {Number(noB)} no
        </div>
      </div>
    </div>
  )
}

function TimeLeft({ end }: { end: bigint }) {
  const secs = Number(end) - Math.floor(Date.now() / 1000)
  if (secs <= 0) return <span className="text-amber-600">window closed — ready to finalize</span>
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  return <span>{h > 0 ? `${h}h ${m % 60}m` : `${m}m ${secs % 60}s`} left</span>
}

function BizCard({ id, biz }: { id: number; biz: Biz }) {
  const [wallet, community, metadataURI, status] = biz
  const meta = STATUS_META[status]
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4 text-primary" />
            <span className="truncate">{metadataURI || `Business #${id}`}</span>
          </CardTitle>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <CardDescription>
          #{id} · {COMMUNITY_LABEL[community]} · owner {short(wallet)}
        </CardDescription>
      </CardHeader>
      {isPoll(status) && (
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            <TimeLeft end={biz[4]} />
          </div>
          <Tally biz={biz} />
        </CardContent>
      )}
    </Card>
  )
}

function ApplyCard({ onDone }: { onDone: () => void }) {
  const [community, setCommunity] = useState<Community>(Community.A)
  const [uri, setUri] = useState("")
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  if (receipt.isSuccess) onDone()

  const apply = () =>
    writeContract({
      ...businessContract,
      functionName: "applyForCertification",
      args: [community, uri],
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FilePlus2 className="h-5 w-5 text-primary" /> Apply for certification
        </CardTitle>
        <CardDescription>
          Any wallet can apply — this opens a certification poll immediately. Members from both
          communities then vote it up or down.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Home community</label>
          <div className="grid grid-cols-2 gap-2">
            {[Community.A, Community.B].map((c) => (
              <button
                key={c}
                onClick={() => setCommunity(c)}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  community === c ? "border-primary bg-accent/40" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium">{COMMUNITY_LABEL[c]}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Metadata (name or ipfs:// URI)</label>
          <input
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="ipfs://… or Amina's Bakery"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        {receipt.isSuccess ? (
          <p className="rounded-lg bg-accent/40 p-3 text-sm">
            Application submitted — a certification poll is now open. Head to the Vote tab.
          </p>
        ) : (
          <TxButton
            className="w-full"
            pending={isPending || receipt.isLoading}
            disabled={uri.trim().length === 0}
            onClick={apply}
          >
            Apply & open certification poll
          </TxButton>
        )}
        {error && (
          <p className="text-sm text-destructive">
            {(error as { shortMessage?: string }).shortMessage || error.message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function VoteCard({
  id,
  biz,
  isMember,
  onDone,
}: {
  id: number
  biz: Biz
  isMember: boolean
  onDone: () => void
}) {
  const [status] = [biz[3]]
  const metadataURI = biz[2]
  const votingEnd = biz[4]
  const now = Math.floor(Date.now() / 1000)
  const closed = now >= Number(votingEnd)
  const poll = isPoll(status)

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  if (receipt.isSuccess) onDone()
  const pending = isPending || receipt.isLoading

  const vote = (support: boolean) =>
    writeContract({ ...businessContract, functionName: "vote", args: [BigInt(id), support] })
  const finalize = () =>
    writeContract({ ...businessContract, functionName: "finalizePoll", args: [BigInt(id)] })
  const openRevocation = () =>
    writeContract({ ...businessContract, functionName: "openRevocation", args: [BigInt(id)] })

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Vote className="h-4 w-4 text-primary" />
            <span className="truncate">{metadataURI || `Business #${id}`}</span>
          </CardTitle>
          <Badge variant={STATUS_META[status].variant}>{STATUS_META[status].label}</Badge>
        </div>
        <CardDescription>
          #{id} · {COMMUNITY_LABEL[biz[1]]}
          {poll && (
            <>
              {" · "}
              <TimeLeft end={votingEnd} />
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {poll && <Tally biz={biz} />}
        {poll && !closed && (
          <div className="grid grid-cols-2 gap-2">
            <TxButton pending={pending} disabled={!isMember} onClick={() => vote(true)}>
              <ThumbsUp className="mr-2 h-4 w-4" /> Support
            </TxButton>
            <TxButton variant="outline" pending={pending} disabled={!isMember} onClick={() => vote(false)}>
              <ThumbsDown className="mr-2 h-4 w-4" /> Oppose
            </TxButton>
          </div>
        )}
        {poll && closed && (
          <TxButton className="w-full" variant="outline" pending={pending} onClick={finalize}>
            Finalize poll
          </TxButton>
        )}
        {status === STATUS.Certified && (
          <TxButton
            className="w-full"
            variant="outline"
            pending={pending}
            disabled={!isMember}
            onClick={openRevocation}
          >
            <Gavel className="mr-2 h-4 w-4" /> Open revocation poll
          </TxButton>
        )}
        {!isMember && poll && (
          <p className="text-xs text-muted-foreground">Verify to vote on this poll.</p>
        )}
        {error && (
          <p className="text-sm text-destructive">
            {(error as { shortMessage?: string }).shortMessage || error.message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function PayIntro({
  bonusBps,
  membership,
}: {
  bonusBps: number
  membership: ReturnType<typeof useMembership>
}) {
  return (
    <div className="rounded-lg bg-accent/40 p-4 text-sm text-accent-foreground">
      You pay in <span className="font-medium">your own</span> community's money
      {membership.community !== Community.None && (
        <> ({membership.communityLabel === "Community A" ? "PEACE-A" : "PEACE-B"})</>
      )}
      . Paying a business across the conflict line earns it a Treasury cooperation bonus of{" "}
      <span className="font-medium">{(bonusBps / 100).toFixed(2)}%</span> in the reserve asset —
      best-effort and capped by a per-epoch budget, so large bonuses may be trimmed.
    </div>
  )
}

function PayCard({
  id,
  biz,
  isMember,
  membership,
  onDone,
}: {
  id: number
  biz: Biz
  isMember: boolean
  membership: ReturnType<typeof useMembership>
  onDone: () => void
}) {
  const { address } = useAccount()
  const [amount, setAmount] = useState("10")
  const bizCommunity = biz[1] as Community
  const payerCommunity = membership.community
  const crossLine = isMember && payerCommunity !== Community.None && payerCommunity !== bizCommunity

  // Payer pays with their own community's PeaceToken; approval goes to the registry.
  const payToken = contract.token(payerCommunity === Community.None ? Community.A : payerCommunity)

  const bal = useReadContract({
    ...payToken,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isMember },
  })
  const allowance = useReadContract({
    ...payToken,
    functionName: "allowance",
    args: address ? [address, businessContract.address] : undefined,
    query: { enabled: !!address && isMember },
  })

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  if (receipt.isSuccess) {
    bal.refetch()
    allowance.refetch()
    onDone()
  }
  const pending = isPending || receipt.isLoading

  const amountWei = (() => {
    try {
      return parseUnits(amount || "0", 18)
    } catch {
      return 0n
    }
  })()
  const needsApproval = (allowance.data as bigint | undefined ?? 0n) < amountWei

  const approve = () =>
    writeContract({
      ...payToken,
      functionName: "approve",
      args: [businessContract.address, amountWei],
    })
  const pay = () =>
    writeContract({
      ...businessContract,
      functionName: "payBusiness",
      args: [BigInt(id), amountWei],
    })

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HandCoins className="h-4 w-4 text-primary" />
            <span className="truncate">{biz[2] || `Business #${id}`}</span>
          </CardTitle>
          {crossLine && <Badge>+cooperation bonus</Badge>}
        </div>
        <CardDescription>
          #{id} · {COMMUNITY_LABEL[bizCommunity]} · owner {short(biz[0])}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isMember && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Your balance</span>
            <span className="font-medium text-foreground">
              {fmt(bal.data as bigint)} {payerCommunity === Community.A ? "PEACE-A" : "PEACE-B"}
            </span>
          </div>
        )}
        <input
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {needsApproval ? (
          <TxButton className="w-full" pending={pending} disabled={!isMember || amountWei === 0n} onClick={approve}>
            Approve {amount || "0"} for registry
          </TxButton>
        ) : (
          <TxButton className="w-full" pending={pending} disabled={!isMember || amountWei === 0n} onClick={pay}>
            Pay business {crossLine ? "(earns bonus)" : ""}
          </TxButton>
        )}
        {!isMember && (
          <p className="text-xs text-muted-foreground">Only verified members can pay businesses.</p>
        )}
        {receipt.isSuccess && (
          <p className="rounded-lg bg-accent/40 p-3 text-sm text-accent-foreground">
            Payment sent{crossLine ? " — the Treasury queues the cooperation bonus for this business" : ""}.{" "}
            <Link href="/pools" className="inline-flex items-center gap-1 font-medium text-primary underline">
              Next: back to the main journey <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive">
            {(error as { shortMessage?: string }).shortMessage || error.message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

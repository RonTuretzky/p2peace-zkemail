"use client"

import { useState } from "react"
import Link from "next/link"
import { useAccount, useBalance, useReadContracts } from "wagmi"
import { parseUnits } from "viem"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Coins, Droplets, ArrowRight } from "lucide-react"
import { ConnectGate, FlowHeader, TxButton, useMembership, useTxSteps } from "@/components/flow"
import { JourneyBar, HonestyNote, PrereqNote } from "@/components/explainer"
import { VisualFrame, VizPledge } from "@/components/journey-visuals"
import { contract } from "@/lib/contracts"
import { Community, RESERVE, SAVINGS_XDAI_ADAPTER } from "@/lib/chains"
import { fmt } from "@/lib/format"

const ZERO = "0x0000000000000000000000000000000000000000" as const
const ADAPTER_ABI = [
  {
    type: "function",
    name: "depositXDAI",
    stateMutability: "payable",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
] as const

export default function MintPage() {
  return (
    <div className="container mx-auto px-4 py-14">
      <FlowHeader
        title="Get Community Money"
        blurb="Verified members convert regular money into their community's money, one-for-one — 90% to your wallet, 10% pledged to your community's peace pool. Supporters abroad join at double the rate, which supports the shared Treasury."
      />
      <MintJourney />
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
        Why this step exists: this is where your community's promise becomes real. A tenth of
        everything you put in is set aside as your side's pledge — money that moves only if your own
        community breaks the rules everyone agreed to. Joining the pool is what gives you a
        voice in writing those rules, and a share when repair flows your way.
      </p>
      <div className="mx-auto mt-8 max-w-xl">
        <VisualFrame caption="90% stays yours · 10% becomes the community's pledge">
          <VizPledge />
        </VisualFrame>
      </div>
      <ConnectGate>
        <MintInner />
      </ConnectGate>
      <HonestyNote>
        Honest limit: every unit of community money is matched by real money sitting in reserve,
        and you can cash back out to sDAI at any time — except the 10% pledge. The pledge is{" "}
        <em>not withdrawable</em> by you: it stays as your community&apos;s promise, or goes
        toward repair on the other side after a verified harmful event. That one-way door is what
        makes the promise worth believing.
      </HonestyNote>
    </div>
  )
}

function MintJourney() {
  const membership = useMembership()
  return <JourneyBar current="/mint" done={membership.isActiveMember ? ["/verify"] : []} />
}

function MintInner() {
  const { address } = useAccount()
  const membership = useMembership()
  const [amount, setAmount] = useState("5")
  const isCitizen = membership.isActiveMember && membership.community !== Community.None
  const community = isCitizen ? membership.community : Community.A

  const balances = useReadContracts({
    contracts: [
      { ...contract.reserve(), functionName: "balanceOf", args: [address ?? ZERO] },
      { ...contract.token(community), functionName: "balanceOf", args: [address ?? ZERO] },
      {
        ...contract.reserve(),
        functionName: "allowance",
        args: [address ?? ZERO, contract.minter(community).address],
      },
    ],
    query: { enabled: !!address },
  })
  const usdBal = (balances.data?.[0]?.result as bigint) ?? 0n
  const tokBal = (balances.data?.[1]?.result as bigint) ?? 0n
  const allowance = (balances.data?.[2]?.result as bigint) ?? 0n
  const xdai = useBalance({ address, query: { enabled: !!address } })

  const amountWei = (() => {
    try {
      return parseUnits(amount || "0", 18)
    } catch {
      return 0n
    }
  })()

  // One gesture: wrap sDAI (if short), approve (if short), then mint.
  const join = useTxSteps(() => balances.refetch())
  const wrap = useTxSteps(() => {
    balances.refetch()
    xdai.refetch()
  })

  const needsSdai = usdBal < amountWei
  const shortfall = amountWei > usdBal ? amountWei - usdBal : 0n

  const doJoin = () =>
    join.run([
      {
        label: "Approve sDAI",
        request: () =>
          allowance >= amountWei
            ? null
            : {
                ...contract.reserve(),
                functionName: "approve",
                args: [contract.minter(community).address, amountWei],
              },
      },
      {
        label: isCitizen ? "Convert to community money" : "Contribute",
        request: () => ({
          ...contract.minter(community),
          functionName: isCitizen ? "mintCitizen" : "mintOutsider",
          args: [amountWei],
        }),
      },
    ])

  // Wrap a little extra xDAI → sDAI (covers rounding) in one tx.
  const doWrapSdai = () =>
    wrap.run([
      {
        label: "Wrap xDAI → sDAI",
        request: () => ({
          address: SAVINGS_XDAI_ADAPTER,
          abi: ADAPTER_ABI,
          functionName: "depositXDAI",
          args: [address!],
          value: shortfall > 0n ? shortfall : amountWei,
        }),
      },
    ])

  const pending = join.running || wrap.running
  const receiptSuccess = join.done
  const error = join.error || wrap.error
  const reset = () => {
    join.reset()
    wrap.reset()
  }

  return (
    <>
      <PrereqNote met={isCitizen} href="/verify" cta="Verify first">
        Supporters can join at 2× — but to convert one-for-one, vote on the rules, and receive your
        community&apos;s share, verify first.
      </PrereqNote>
      <div className="mx-auto mt-10 grid max-w-4xl gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" /> Balances
          </CardTitle>
          <CardDescription>Your sDAI and your community money.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="sDAI (reserve)" value={fmt(usdBal)} />
          <Row
            label={community === Community.A ? "Community A money (PEACE-A)" : "Community B money (PEACE-B)"}
            value={fmt(tokBal)}
          />
          <Row label="xDAI (for gas + wrapping)" value={fmt(xdai.data?.value)} />
          <Row
            label="Joining as"
            value={
              <Badge variant={isCitizen ? "default" : "outline"}>
                {isCitizen ? `Member · ${membership.communityLabel}` : "Supporter (2× rate)"}
              </Badge>
            }
          />
          <TxButton
            variant="outline"
            className="w-full"
            pending={wrap.running}
            disabled={!needsSdai || amountWei === 0n}
            onClick={doWrapSdai}
          >
            <Droplets className="mr-2 h-4 w-4 text-primary" />
            {needsSdai ? `Get ${amount || "0"} sDAI (wrap xDAI, 1 click)` : "You have enough sDAI ✓"}
          </TxButton>
          <p className="text-center text-[11px] text-muted-foreground">
            Wraps xDAI → sDAI in one transaction, right here — no external site. Or{" "}
            <a href={RESERVE.getUrl} target="_blank" rel="noreferrer" className="underline">
              swap on CoW
            </a>
            .
          </p>
          {!isCitizen && (
            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              You are not verified yet, so you join at the supporter rate and cannot
              vote. <a className="text-primary underline" href="/verify">Get verified</a> to join
              one-for-one and have a vote.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Join</CardTitle>
          <CardDescription>
            {isCitizen
              ? "One-for-one — 90% to you, 10% into your community peace pool."
              : "Pay double; half backs your money, half supports the Treasury."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm font-medium">Amount (sDAI)</label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            {isCitizen ? (
              <>
                Read it like this: of your {amount || "0"} sDAI, {" "}
                <span className="font-medium text-foreground">90% lands in your wallet</span> and{" "}
                <span className="font-medium text-foreground">10% becomes your community&apos;s pledge</span>.
                The largest amount an event can ever move from the pool is 5% of it — and only if
                your community&apos;s side causes a verified harmful event.
              </>
            ) : (
              <>
                Read it like this: as a supporter you put in {amount || "0"} sDAI and receive community
                money worth half that — the other half supports the shared Treasury that rewards
                steps toward peace. It is a donation with a receipt, not an investment.
              </>
            )}
          </p>
          <TxButton
            className="w-full"
            pending={pending}
            disabled={amountWei === 0n || needsSdai}
            onClick={doJoin}
          >
            {join.running
              ? join.stepLabel || "Working…"
              : isCitizen
                ? "Join — approve + convert in one click"
                : "Contribute as a supporter"}
          </TxButton>
          {needsSdai && amountWei > 0n && (
            <p className="text-center text-xs text-amber-600">
              Get {amount || "0"} sDAI first (button on the left).
            </p>
          )}
          {receiptSuccess && (
            <div className="rounded-lg bg-accent/40 p-3 text-sm" onClick={reset}>
              <p className="font-medium text-primary">
                Done — you converted, and 10% is now your community&apos;s pledge.
              </p>
              <Link
                href="/incentives"
                className="mt-1 inline-flex items-center gap-1 font-medium text-primary underline"
              >
                Next step: help decide which news events move money <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
      </div>
    </>
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

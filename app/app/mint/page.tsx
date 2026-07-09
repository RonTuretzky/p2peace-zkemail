"use client"

import { useState } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseUnits } from "viem"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Coins, Droplets } from "lucide-react"
import { ConnectGate, FlowHeader, TxButton, useMembership } from "@/components/flow"
import { contract } from "@/lib/contracts"
import { Community } from "@/lib/chains"
import { fmt } from "@/lib/format"

export default function MintPage() {
  return (
    <div className="container mx-auto px-4 py-14">
      <FlowHeader
        title="Mint Peace Tokens"
        blurb="Verified citizens mint their community token 1:1 against the reserve — 90% to your wallet, 10% staked into your peace pool. Outsiders mint at a 2× premium that funds the shared Treasury."
      />
      <ConnectGate>
        <MintInner />
      </ConnectGate>
    </div>
  )
}

function MintInner() {
  const { address } = useAccount()
  const membership = useMembership()
  const [amount, setAmount] = useState("100")
  const isCitizen = membership.isActiveMember && membership.community !== Community.None
  const community = isCitizen ? membership.community : Community.A

  const usdBal = useReadContract({
    ...contract.mockUsd(),
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
  const tokBal = useReadContract({
    ...contract.token(community),
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
  const allowance = useReadContract({
    ...contract.mockUsd(),
    functionName: "allowance",
    args: address ? [address, contract.minter(community).address] : undefined,
    query: { enabled: !!address },
  })

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  if (receipt.isSuccess) {
    usdBal.refetch()
    tokBal.refetch()
    allowance.refetch()
  }

  const amountWei = (() => {
    try {
      return parseUnits(amount || "0", 18)
    } catch {
      return 0n
    }
  })()
  const needsApproval = (allowance.data ?? 0n) < amountWei

  const faucet = () =>
    writeContract({
      ...contract.mockUsd(),
      functionName: "mint",
      args: [address!, parseUnits("1000", 18)],
    })
  const approve = () =>
    writeContract({
      ...contract.mockUsd(),
      functionName: "approve",
      args: [contract.minter(community).address, amountWei],
    })
  const mint = () =>
    writeContract({
      ...contract.minter(community),
      functionName: isCitizen ? "mintCitizen" : "mintOutsider",
      args: [amountWei],
    })

  const pending = isPending || receipt.isLoading

  return (
    <div className="mx-auto mt-10 grid max-w-4xl gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" /> Balances
          </CardTitle>
          <CardDescription>Reserve asset and your community token.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="mUSD (reserve)" value={fmt(usdBal.data as bigint)} />
          <Row
            label={community === Community.A ? "PEACE-A" : "PEACE-B"}
            value={fmt(tokBal.data as bigint)}
          />
          <Row
            label="Minting as"
            value={
              <Badge variant={isCitizen ? "default" : "outline"}>
                {isCitizen ? `Citizen · ${membership.communityLabel}` : "Outsider (2× premium)"}
              </Badge>
            }
          />
          <TxButton variant="outline" className="w-full" pending={pending} onClick={faucet}>
            <Droplets className="mr-2 h-4 w-4" /> Get 1,000 test mUSD
          </TxButton>
          {!isCitizen && (
            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              You are not a verified citizen, so you mint at the outsider premium and cannot
              vote. <a className="text-primary underline" href="/verify">Get verified</a> to mint
              1:1 and participate in governance.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mint</CardTitle>
          <CardDescription>
            {isCitizen
              ? "1:1 — 90% to you, 10% into your community peace pool."
              : "Pay 2× par; half backs your tokens, half funds the Treasury."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm font-medium">Amount (mUSD)</label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {needsApproval ? (
            <TxButton className="w-full" pending={pending} onClick={approve}>
              Approve {amount || "0"} mUSD
            </TxButton>
          ) : (
            <TxButton className="w-full" pending={pending} onClick={mint} disabled={amountWei === 0n}>
              Mint {isCitizen ? "as citizen" : "as outsider"}
            </TxButton>
          )}
          {receipt.isSuccess && (
            <p className="text-sm text-primary" onClick={reset}>
              Confirmed. Balances updated.
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive">
              {(error as { shortMessage?: string }).shortMessage || error.message}
            </p>
          )}
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

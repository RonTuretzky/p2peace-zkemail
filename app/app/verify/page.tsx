"use client"

import { useState } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, Mail, CheckCircle2, RotateCcw } from "lucide-react"
import { ConnectGate, FlowHeader, TxButton, useMembership } from "@/components/flow"
import { contract } from "@/lib/contracts"
import { Community } from "@/lib/chains"
import { buildCitizenshipProof, DEMO_DOMAINS } from "@/lib/demo"
import { short } from "@/lib/format"

const COMMUNITIES = [
  { c: Community.A, label: "Community A", domain: DEMO_DOMAINS.govA },
  { c: Community.B, label: "Community B", domain: DEMO_DOMAINS.govB },
]

export default function VerifyPage() {
  return (
    <div className="container mx-auto px-4 py-14">
      <FlowHeader
        title="Get Verified with zkEmail"
        blurb="Prove you receive DKIM-signed email from an allowlisted government domain. Your address never goes on-chain — only a nullifier that binds one inbox to one membership."
      />
      <ConnectGate>
        <VerifyInner />
      </ConnectGate>
    </div>
  )
}

function VerifyInner() {
  const { address } = useAccount()
  const membership = useMembership()
  const [choice, setChoice] = useState<Community>(Community.A)
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })

  const register = () => {
    if (!address) return
    const proof = buildCitizenshipProof(address, choice)
    writeContract({
      ...contract.identity(),
      functionName: "register",
      args: [proof, address],
    })
  }

  // Refresh membership once the tx confirms.
  if (receipt.isSuccess) membership.refetch()

  return (
    <div className="mx-auto mt-10 grid max-w-4xl gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Your membership
          </CardTitle>
          <CardDescription>Live from the IdentityRegistry on Gnosis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Wallet" value={short(address)} />
          <Row
            label="Status"
            value={
              <Badge variant={membership.isActiveMember ? "default" : "outline"}>
                {membership.isActiveMember ? "Active member" : "Not verified"}
              </Badge>
            }
          />
          <Row label="Community" value={membership.communityLabel} />
          {membership.isActiveMember && (
            <p className="rounded-lg bg-accent/40 p-3 text-sm text-accent-foreground">
              You can now mint tokens, vote on incentives, attest events, and claim pool rewards.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Prove citizenship
          </CardTitle>
          <CardDescription>
            Pick which community your government email is from. In production this proof is
            generated in your browser from a saved <code>.eml</code>; the demo builds a
            structurally-real proof the on-chain checks accept.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {COMMUNITIES.map((o) => (
              <button
                key={o.c}
                onClick={() => setChoice(o.c)}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  choice === o.c
                    ? "border-primary bg-accent/40"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium">{o.label}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{o.domain}</div>
              </button>
            ))}
          </div>

          {receipt.isSuccess ? (
            <div className="flex flex-col items-center gap-3 rounded-lg bg-accent/40 p-4 text-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <p className="text-sm">
                Verified as {membership.communityLabel}. Membership is valid for one year and
                renewable with a fresh proof.
              </p>
              <TxButton variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="mr-2 h-4 w-4" /> Register another
              </TxButton>
            </div>
          ) : (
            <TxButton
              className="w-full"
              pending={isPending || receipt.isLoading}
              onClick={register}
            >
              {membership.isActiveMember ? "Renew / switch membership" : "Submit zkEmail proof"}
            </TxButton>
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

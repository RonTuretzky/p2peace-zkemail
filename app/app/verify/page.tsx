"use client"

import { useState } from "react"
import Link from "next/link"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, Mail, CheckCircle2, RotateCcw, ArrowRight } from "lucide-react"
import { ConnectGate, FlowHeader, TxButton, useMembership } from "@/components/flow"
import { JourneyBar, HonestyNote } from "@/components/explainer"
import { VisualFrame, VizVerify } from "@/components/journey-visuals"
import { RealEmailVerify } from "@/components/real-email-verify"
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
      <JourneyBar current="/verify" />
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
        Why this step exists: everything downstream — one-for-one joining, one-person voting, equal pool
        shares — assumes one person cannot be two members. zkEmail gives us that without a
        passport office: your government inbox becomes the credential, and only its nullifier ever
        touches the chain.
      </p>
      <div className="mx-auto mt-8 max-w-xl">
        <VisualFrame caption="a government email in → an anonymous membership out">
          <VizVerify />
        </VisualFrame>
      </div>
      <ConnectGate>
        <div className="space-y-2">
          <p className="mx-auto max-w-3xl text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Two ways to verify
          </p>
          <RealEmailVerify />
          <div className="mx-auto mt-8 max-w-3xl">
            <p className="mb-2 text-center text-xs text-muted-foreground">
              …or use the one-click demo proof below (no real email needed — for walking the
              flow; it accepts any proof, so it proves nothing about a real inbox).
            </p>
          </div>
          <VerifyInner />
        </div>
      </ConnectGate>
      <HonestyNote>
        Honest limit: this proves control of <em>one government inbox</em>, not one human. Someone
        with two email accounts on the allowlisted domain gets two memberships; someone the
        government never issued an address to gets none. It is a practical sybil floor tied to
        existing civil registries — not a biometric proof of personhood.
      </HonestyNote>
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
            <div className="rounded-lg bg-accent/40 p-3 text-sm text-accent-foreground">
              You can now add money, vote on the rules, attest events, and claim your community's share.{" "}
              <Link href="/mint" className="inline-flex items-center gap-1 font-medium text-primary underline">
                Next: add money one-for-one <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
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
              <Link
                href="/mint"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline"
              >
                Next step: get community money, one-for-one <ArrowRight className="h-4 w-4" />
              </Link>
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

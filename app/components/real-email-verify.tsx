"use client"

import { useState } from "react"
import Link from "next/link"
import { keccak256, encodePacked } from "viem"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UploadSimple, ShieldCheck, CheckCircle, Warning } from "@phosphor-icons/react"
import { TxButton, useMembership } from "@/components/flow"
import { contract } from "@/lib/contracts"
import { parseEml, type ParsedEmail } from "@/lib/dkim"

/**
 * RealEmailVerify — the "verify with your actual email" path. Everything runs in
 * the browser: the .eml is parsed and DKIM-canonicalized here (lib/dkim.ts), then
 * only the signed headers + signature are submitted to IdentityRegistry.registerReal,
 * which verifies the RSA signature fully on-chain (RealEmailVerifier). No mock.
 *
 * Honest: this is authenticity, not privacy — the signed headers (which include the
 * recipient address) are public calldata. The ZK path keeps the email private.
 */
export function RealEmailVerify() {
  const { address } = useAccount()
  const membership = useMembership()
  const [parsed, setParsed] = useState<ParsedEmail | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  if (receipt.isSuccess) membership.refetch()

  const onFile = async (file: File) => {
    reset()
    setParseError(null)
    setParsed(null)
    setFileName(file.name)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      const p = parseEml(buf)
      setParsed(p)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Could not parse this .eml file")
    }
  }

  const submit = () => {
    if (!parsed || !address) return
    const keyId = keccak256(
      encodePacked(["string", "string", "string"], [parsed.domain, ":", parsed.selector]),
    )
    writeContract({
      ...contract.identity(),
      functionName: "registerReal",
      args: [keyId, parsed.signedHeaders, parsed.signature, address],
    })
  }

  const pending = isPending || receipt.isLoading

  return (
    <Card className="mx-auto mt-8 max-w-3xl border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" weight="bold" />
          Verify with your <em className="not-italic text-primary">real</em> email
        </CardTitle>
        <CardDescription>
          Upload an email you actually received from your government (e.g. a one-time-code
          message from <code>noreply@btl.gov.il</code>). Its DKIM signature is verified fully
          on-chain — genuine cryptography, no demo shortcut.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-8 transition-colors hover:border-primary/50">
          <UploadSimple className="h-7 w-7 text-primary" weight="bold" />
          <span className="text-sm font-medium">
            {fileName || "Drop or choose a .eml file"}
          </span>
          <span className="text-xs text-muted-foreground">
            Get it from Gmail → ⋮ → “Download message”, or your mail client’s “Save as .eml”.
          </span>
          <input
            type="file"
            accept=".eml,message/rfc822,text/plain"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>

        {parseError && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <Warning className="h-4 w-4" weight="bold" /> {parseError}
          </p>
        )}

        {parsed && (
          <div className="space-y-3 rounded-xl bg-muted/50 p-4">
            <Row label="Signed by (DKIM domain)" value={parsed.domain} />
            <Row label="Sender (From)" value={parsed.from} mono />
            <Row label="Selector" value={parsed.selector} mono />
            <p className="text-xs text-muted-foreground">
              The signed headers ({(parsed.signedHeaders.length - 2) / 2} bytes) and the RSA
              signature will be submitted; the contract recomputes the hash and verifies the
              signature against the registered key. Only a genuine, unaltered government email
              passes.
            </p>
          </div>
        )}

        {receipt.isSuccess ? (
          <div className="flex flex-col items-center gap-2 rounded-lg bg-accent/40 p-4 text-center">
            <CheckCircle className="h-8 w-8 text-primary" weight="fill" />
            <p className="text-sm">
              Verified on-chain from your real email. You’re now a{" "}
              {membership.communityLabel} member.
            </p>
            <Link href="/mint" className="text-sm font-medium text-primary underline">
              Next step: get community money →
            </Link>
          </div>
        ) : (
          <TxButton className="w-full" pending={pending} disabled={!parsed} onClick={submit}>
            {parsed ? "Verify this email on-chain" : "Choose an email first"}
          </TxButton>
        )}

        {error && (
          <p className="text-sm text-destructive">
            {friendlyError((error as { shortMessage?: string }).shortMessage || error.message)}
          </p>
        )}

        <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Privacy note:</span> this real path
          proves your email is genuine but is <em>not</em> zero-knowledge — the signed headers,
          including your email address, become public calldata. It exists so the mechanism can be
          tried with a real inbox today. The production path uses a zkEmail circuit that proves
          the same thing while keeping the email private. Use a throwaway wallet and keep amounts
          tiny.
        </p>
      </CardContent>
    </Card>
  )
}

function friendlyError(msg: string): string {
  if (/RealKeyNotMapped/.test(msg)) {
    return "This email's DKIM key isn't registered for a community yet. The demo currently recognizes btl.gov.il mail signed by its Amazon SES key; other senders/selectors need to be added by governance first."
  }
  if (/BadSignature/.test(msg)) {
    return "The signature didn't verify. The email may have been altered in transit (forwarding breaks DKIM) — use one you received directly and downloaded as-is."
  }
  if (/WalletAlreadyMember/.test(msg)) return "This wallet is already a member."
  return msg
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`truncate font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  )
}

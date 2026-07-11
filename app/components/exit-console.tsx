"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { formatUnits, parseUnits } from "viem"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowCircleUp, ArrowCircleDown, Flag, UploadSimple, Warning, CheckCircle, LockSimple } from "@phosphor-icons/react"
import { TxButton, useTxSteps, useMembership } from "@/components/flow"
import { HonestyNote } from "@/components/explainer"
import { contract } from "@/lib/contracts"
import { ADDRESSES, EXIT_PROVENANCE } from "@/lib/chains"
import { parseReceiptEml, type ParsedReceipt } from "@/lib/dkim"
import { keccak256, encodePacked, concat } from "viem"

const DEC = 18
const f2 = (v: bigint | undefined, frac = 2) =>
  v === undefined ? "0" : Number(formatUnits(v, DEC)).toLocaleString(undefined, { maximumFractionDigits: frac })

/** Amount input styled to match the flow pages. */
function AmountInput({
  value,
  onChange,
  placeholder = "0.0",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border-2 border-border bg-card px-3 py-2 focus-within:border-primary/50">
      <input
        inputMode="decimal"
        className="w-full bg-transparent text-lg font-semibold outline-none"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
      />
      <span className="text-sm font-semibold text-muted-foreground">sDAI</span>
    </div>
  )
}

export function ExitConsole() {
  const { isActiveMember, communityLabel } = useMembership()

  if (!isActiveMember) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-muted-foreground">
            The Exit is for verified community members — one person, one position.
          </p>
          <Link href="/verify" className="font-semibold text-primary underline">
            Verify your membership first →
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <p className="mb-4 text-center text-sm text-muted-foreground">
        You&apos;re a <span className="font-semibold text-foreground">{communityLabel}</span> member.
        Everything here is your own sDAI — always redeemable, never anyone else&apos;s to move.
      </p>
      <Tabs defaultValue="move" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="move">Move money out</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="prove">Prove the source</TabsTrigger>
        </TabsList>
        <TabsContent value="move">
          <MovePanel />
        </TabsContent>
        <TabsContent value="campaigns">
          <CampaignsPanel />
        </TabsContent>
        <TabsContent value="prove">
          <ProvenancePanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ------------------------------------------------------------- commit / redeem */

function MovePanel() {
  const { address } = useAccount()
  const [amount, setAmount] = useState("")

  const reads = useReadContracts({
    contracts: [
      { ...contract.exitAssurance(), functionName: "positionOf", args: [address!] },
      { ...contract.exitAssurance(), functionName: "freePositionOf", args: [address!] },
      { ...contract.reserve(), functionName: "balanceOf", args: [address!] },
      { ...contract.reserve(), functionName: "allowance", args: [address!, ADDRESSES.exitAssurance] },
    ],
    query: { enabled: !!address, refetchInterval: 8000 },
  })
  const position = reads.data?.[0]?.result as bigint | undefined
  const free = reads.data?.[1]?.result as bigint | undefined
  const wallet = reads.data?.[2]?.result as bigint | undefined
  const allowance = (reads.data?.[3]?.result as bigint | undefined) ?? 0n

  const wei = useMemo(() => {
    try {
      return amount ? parseUnits(amount, DEC) : 0n
    } catch {
      return 0n
    }
  }, [amount])

  const commit = useTxSteps(() => {
    setAmount("")
    reads.refetch()
  })
  const redeem = useTxSteps(() => {
    setAmount("")
    reads.refetch()
  })

  const doCommit = () =>
    commit.run([
      {
        label: "Approve sDAI",
        request: () =>
          allowance >= wei
            ? null
            : { ...contract.reserve(), functionName: "approve", args: [ADDRESSES.exitAssurance, wei] },
      },
      {
        label: "Move it out of the shekel",
        request: () => ({ ...contract.exitAssurance(), functionName: "commit", args: [wei] }),
      },
    ])

  const doRedeem = () =>
    redeem.run([
      { label: "Bring it back", request: () => ({ ...contract.exitAssurance(), functionName: "redeem", args: [wei] }) },
    ])

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Your exit position</CardTitle>
        <CardDescription>
          Locking sDAI here is the honest, measurable exit: value now denominated in money the two
          communities govern together, not in the national currency. It counts in the Exit Index the
          moment it lands, and shrinks the moment you bring it back.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Your exit" value={f2(position)} />
          <Stat label="Redeemable" value={f2(free)} />
          <Stat label="In wallet" value={f2(wallet)} />
        </div>

        <AmountInput value={amount} onChange={setAmount} />

        <div className="grid grid-cols-2 gap-3">
          <TxButton
            pending={commit.running}
            disabled={wei === 0n || (wallet !== undefined && wei > wallet)}
            onClick={doCommit}
          >
            <ArrowCircleUp className="mr-1.5 h-4 w-4" weight="bold" />
            {commit.running ? commit.stepLabel : "Move out"}
          </TxButton>
          <TxButton
            variant="outline"
            pending={redeem.running}
            disabled={wei === 0n || (free !== undefined && wei > free)}
            onClick={doRedeem}
          >
            <ArrowCircleDown className="mr-1.5 h-4 w-4" weight="bold" /> Bring back
          </TxButton>
        </div>

        {(commit.error || redeem.error) && (
          <p className="text-sm text-destructive">{commit.error || redeem.error}</p>
        )}

        <HonestyNote>
          This measures a <em>stock</em> — sDAI held right now — not a claim that these coins were ever
          shekels. That&apos;s the one thing provable with zero trust, and it resists round-trips by
          construction: bring it back and the number drops. Whether it truly came from shekels is a
          separate, best-effort attestation on the &ldquo;Prove the source&rdquo; tab.
        </HonestyNote>
      </CardContent>
    </Card>
  )
}

/* ---------------------------------------------------------------- campaigns */

interface CampaignView {
  id: number
  creator: string
  goal: bigint
  deadline: bigint
  total: bigint
  reached: boolean
  uri: string
}

function CampaignsPanel() {
  const { address } = useAccount()
  const countRead = useReadContract({
    ...contract.exitAssurance(),
    functionName: "campaignCount",
    query: { refetchInterval: 10000 },
  })
  const count = Number(countRead.data ?? 0n)

  const detailReads = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      ...contract.exitAssurance(),
      functionName: "getCampaign" as const,
      args: [BigInt(i)],
    })),
    query: { enabled: count > 0, refetchInterval: 10000 },
  })

  const campaigns: CampaignView[] = (detailReads.data ?? [])
    .map((r, i) => {
      const t = r.result as unknown as [string, number, bigint, bigint, bigint, boolean, string] | undefined
      if (!t) return null
      return { id: i, creator: t[0], goal: t[2], deadline: t[3], total: t[4], reached: t[5], uri: t[6] }
    })
    .filter(Boolean) as CampaignView[]

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Assurance campaigns</CardTitle>
        <CardDescription>
          The &ldquo;I&apos;ll go if you go&rdquo; problem, solved on-chain: pledge to a shared goal
          (&ldquo;together we move ₪N out&rdquo;). A pledge counts immediately and can always be
          withdrawn — the threshold just makes the collective move legible when it happens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CreateCampaign onCreated={() => countRead.refetch()} />
        {campaigns.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No campaigns yet. Start the first one above.
          </p>
        )}
        {campaigns
          .slice()
          .reverse()
          .map((c) => (
            <CampaignRow key={c.id} c={c} me={address} onChange={() => detailReads.refetch()} />
          ))}
      </CardContent>
    </Card>
  )
}

function CreateCampaign({ onCreated }: { onCreated: () => void }) {
  const [goal, setGoal] = useState("")
  const [days, setDays] = useState("30")
  const create = useTxSteps(() => {
    setGoal("")
    onCreated()
  })
  const submit = () => {
    let wei = 0n
    try {
      wei = parseUnits(goal, DEC)
    } catch {
      return
    }
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(days || "30") * 86400)
    create.run([
      {
        label: "Open campaign",
        request: () => ({
          ...contract.exitAssurance(),
          functionName: "createCampaign",
          args: [wei, deadline, ""],
        }),
      },
    ])
  }
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border p-3">
      <div className="min-w-[8rem] flex-1">
        <label className="text-xs font-medium text-muted-foreground">Goal (sDAI)</label>
        <AmountInput value={goal} onChange={setGoal} placeholder="100000" />
      </div>
      <div className="w-20">
        <label className="text-xs font-medium text-muted-foreground">Days</label>
        <input
          inputMode="numeric"
          value={days}
          onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))}
          className="w-full rounded-xl border-2 border-border bg-card px-3 py-2 text-lg font-semibold outline-none focus:border-primary/50"
        />
      </div>
      <TxButton pending={create.running} disabled={!goal} onClick={submit}>
        <Flag className="mr-1.5 h-4 w-4" weight="bold" /> Start
      </TxButton>
    </div>
  )
}

function CampaignRow({ c, me, onChange }: { c: CampaignView; me?: string; onChange: () => void }) {
  const [amount, setAmount] = useState("")
  const pct = c.goal > 0n ? Math.min(100, Number((c.total * 100n) / c.goal)) : 0

  const allowance = useReadContract({
    ...contract.reserve(),
    functionName: "allowance",
    args: me ? [me as `0x${string}`, ADDRESSES.exitAssurance] : undefined,
    query: { enabled: !!me },
  })

  const pledge = useTxSteps(() => {
    setAmount("")
    onChange()
  })
  const doPledge = () => {
    let wei = 0n
    try {
      wei = parseUnits(amount, DEC)
    } catch {
      return
    }
    const a = (allowance.data as bigint | undefined) ?? 0n
    pledge.run([
      {
        label: "Approve sDAI",
        request: () =>
          a >= wei ? null : { ...contract.reserve(), functionName: "approve", args: [ADDRESSES.exitAssurance, wei] },
      },
      {
        label: "Pledge",
        request: () => ({ ...contract.exitAssurance(), functionName: "pledge", args: [BigInt(c.id), wei] }),
      },
    ])
  }

  const daysLeft = Math.max(0, Math.ceil((Number(c.deadline) - Date.now() / 1000) / 86400))

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-semibold">
          Goal ₪{f2(c.goal, 0)}
          {c.reached && (
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
              reached
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{daysLeft}d left</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        ₪{f2(c.total, 0)} committed ({pct}%)
      </div>
      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <AmountInput value={amount} onChange={setAmount} />
        </div>
        <TxButton pending={pledge.running} disabled={!amount} onClick={doPledge}>
          {pledge.running ? pledge.stepLabel : "Pledge"}
        </TxButton>
      </div>
      {pledge.error && <p className="mt-2 text-sm text-destructive">{pledge.error}</p>}
    </div>
  )
}

/* --------------------------------------------------------------- provenance */

function ProvenancePanel() {
  const { address } = useAccount()
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null)
  const [fileName, setFileName] = useState("")
  const [parseError, setParseError] = useState<string | null>(null)

  const attest = useTxSteps()
  const isBit2c = parsed?.domain.toLowerCase() === EXIT_PROVENANCE.rampDomain

  const onFile = async (file: File) => {
    attest.reset()
    setParseError(null)
    setParsed(null)
    setFileName(file.name)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      setParsed(parseReceiptEml(buf))
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Could not parse this .eml file")
    }
  }

  // Private path: prove you hold the receipt WITHOUT the address/email touching
  // calldata — only a nullifier is revealed. (Demo tier: the proof is a mock, so the
  // real cryptographic check is pending a compiled circuit; the anonymity model is
  // real and swaps in without a contract change.)
  const proveZK = () => {
    if (!parsed || !address) return
    // Stand-in nullifier: keccak(signature ‖ wallet). A real circuit derives
    // Poseidon(dkimSig, walletSecret) privately so even Bit2C can't recompute it.
    const nullifier = keccak256(concat([parsed.signature as `0x${string}`, address]))
    const proof = {
      dkimPubkeyHash: EXIT_PROVENANCE.bit2cKeyHash as `0x${string}`,
      domainHash: EXIT_PROVENANCE.bit2cDomainHash as `0x${string}`,
      nullifier,
      patternHash: EXIT_PROVENANCE.exitPattern as `0x${string}`,
      emailTimestamp: BigInt(Math.floor(Date.now() / 1000)),
      proof: Array(8).fill(0n) as bigint[],
    }
    attest.run([
      {
        label: "Prove privately (only a nullifier goes on-chain)",
        request: () => ({
          ...contract.exitAssurance(),
          functionName: "attestProvenanceZK",
          args: [proof],
        }),
      },
    ])
  }

  // Public path: verify the real DKIM signature + body + address fully on-chain.
  const provePublic = () => {
    if (!parsed) return
    const keyId = keccak256(
      encodePacked(["string", "string", "string"], [parsed.domain, ":", parsed.selector]),
    )
    attest.run([
      {
        label: "Verify the receipt on-chain (public)",
        request: () => ({
          ...contract.exitAssurance(),
          functionName: "attestProvenance",
          args: [keyId, parsed.signedHeaders, parsed.signature, parsed.body],
        }),
      },
    ])
  }

  const bodyBytes = parsed ? (parsed.body.length - 2) / 2 : 0
  // A full HTML receipt (Bit2C's is ~37 KB) exceeds the block gas limit on the public
  // path; steer those to the private path rather than let a tx fail.
  const tooLargeForPublic = bodyBytes > 12000

  return (
    <Card className="mt-4 border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg">Prove it came from shekels (advanced)</CardTitle>
        <CardDescription>
          Upload the withdrawal-confirmation email your exchange sent (Bit2C is recognized). It&apos;s
          DKIM-signed, so it&apos;s tamper-proof, and it names the destination address you own — the
          receipt can only ever count for that wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-7 transition-colors hover:border-primary/50">
          <UploadSimple className="h-6 w-6 text-primary" weight="bold" />
          <span className="text-sm font-medium">{fileName || "Choose a Bit2C withdrawal .eml"}</span>
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
          <div className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
            <Row label="Signed by" value={parsed.domain} />
            <Row label="From" value={parsed.from} mono />
            {!isBit2c && (
              <p className="flex items-center gap-2 text-xs text-amber-600">
                <Warning className="h-4 w-4" weight="bold" /> Only Bit2C is allowlisted right now — this
                sender will be rejected on-chain.
              </p>
            )}
          </div>
        )}

        {attest.done ? (
          <div className="flex flex-col items-center gap-1.5 rounded-lg bg-accent/40 p-4 text-center">
            <CheckCircle className="h-7 w-7 text-primary" weight="fill" />
            <p className="text-sm">Provenance attached to your exit — no address revealed.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <TxButton
              className="w-full"
              pending={attest.running}
              disabled={!parsed}
              onClick={proveZK}
            >
              <LockSimple className="mr-1.5 h-4 w-4" weight="bold" />
              {attest.running ? attest.stepLabel : "Prove privately — hides your address (recommended)"}
            </TxButton>
            <details className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">
                Or verify publicly (real on-chain crypto, reveals the address)
              </summary>
              <p className="mt-2">
                Verifies the DKIM signature, body hash, and address entirely on-chain — genuine
                cryptography, today. But the whole signed email goes into public calldata (revealing
                your address), and a full HTML receipt ({bodyBytes.toLocaleString()} bytes here) can
                exceed the block gas limit. Use the private path unless you specifically want a public,
                fully-verified attestation of a compact receipt.
              </p>
              {tooLargeForPublic && (
                <p className="mt-2 flex items-center gap-2 text-amber-600">
                  <Warning className="h-4 w-4" weight="bold" /> This receipt is too large (
                  {bodyBytes.toLocaleString()} bytes) for the public path — it would exceed the block
                  gas limit. Use the private path above.
                </p>
              )}
              <TxButton
                className="mt-2 w-full"
                variant="outline"
                pending={attest.running}
                disabled={!parsed || tooLargeForPublic}
                onClick={provePublic}
              >
                Verify publicly on-chain
              </TxButton>
            </details>
          </div>
        )}

        {attest.error && (
          <p className="text-sm text-destructive">{friendlyProvenanceError(attest.error)}</p>
        )}

        <HonestyNote>
          What this proves and what it doesn&apos;t: it proves a regulated exchange genuinely{" "}
          <em>issued you</em> a withdrawal to an address you own — authenticity, bound to you. It does{" "}
          <em>not</em> prove a net exit (a round-trip or a borrowed-shekel withdrawal still yields a
          valid receipt), so it&apos;s reported as its own number, never mixed into the trustless Exit
          Index. The private path reveals only a nullifier — not your address, amount, or email; the
          real cryptographic check is a mock until the zkEmail circuit is compiled (the anonymity
          model is final and swaps in without a contract change).
        </HonestyNote>
      </CardContent>
    </Card>
  )
}

function friendlyProvenanceError(msg: string): string {
  if (/RampNotMapped/.test(msg))
    return "This sender isn't an allowlisted ramp yet. No exchange emits a conforming, address-bound conversion receipt (or settles on Gnosis) today — see the note below. The verifier is live; it's waiting on a real sender."
  if (/AddressMismatch/.test(msg))
    return "This receipt names a different destination address than your wallet. A receipt only counts for the address it was sent to."
  if (/BodyHashMismatch/.test(msg))
    return "The receipt body didn't match its signature (forwarding or editing breaks it). Use the original as received."
  if (/ReceiptAlreadyUsed/.test(msg)) return "This receipt has already been attested."
  return msg
}

/* ------------------------------------------------------------------- shared */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold">{value}</div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`truncate font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail, ShieldCheck, CheckCircle2, Radio, ArrowRight } from "lucide-react"
import { ConnectGate, FlowHeader, TxButton, useMembership } from "@/components/flow"
import { JourneyBar, HonestyNote, PrereqNote } from "@/components/explainer"
import { contract } from "@/lib/contracts"
import { Community, SourceCategory } from "@/lib/chains"
import { buildNewsProof, demoSources } from "@/lib/demo"
import { short, DIRECTION_LABEL } from "@/lib/format"

const incentiveContract = contract.incentive()
const attestationContract = contract.attestation()

const DEMO_PROOF = [
  {
    field: "dkimPubkeyHash",
    value: "0x1f8a…c4e2",
    note: "Poseidon hash of the RSA key that signed the email — checked against the on-chain DKIMRegistry",
  },
  {
    field: "domainHash",
    value: "keccak256(sender domain)",
    note: "The sender domain, matched against the incentive's approved source set and tagged A / B / International",
  },
  {
    field: "nullifier",
    value: "Poseidon(dkimSignature)",
    note: "Unique per physical email — this newsletter can never be counted twice in a round",
  },
  {
    field: "patternHash",
    value: "0x7d31…09af",
    note: "Commitment to the compiled keyword circuit the body matched — must equal the incentive's committed pattern",
  },
  {
    field: "emailTimestamp",
    value: "Date header (DKIM-covered)",
    note: "Must be within 30 days of now and inside the event span of the round's first report",
  },
  {
    field: "proof[8]",
    value: "Groth16 πA, πB, πC",
    note: "The zero-knowledge proof itself; extraData is 0 for attestations (it binds a wallet only for identity proofs)",
  },
]

const CATEGORY_META: Record<number, { label: string; blurb: string }> = {
  [SourceCategory.CommunityA]: { label: "Community A sources", blurb: "Outlets aligned with community A" },
  [SourceCategory.CommunityB]: { label: "Community B sources", blurb: "Outlets aligned with community B" },
  [SourceCategory.International]: { label: "International sources", blurb: "Neutral third-party wire services" },
}

const ATTEST_ERRORS: Record<string, string> = {
  UnknownSource: "That domain is not in this incentive's approved source set.",
  DomainAlreadyCounted: "This outlet has already been counted in the current round.",
  EmailAlreadyCounted: "This exact email (nullifier) was already attested in this round.",
  CooldownActive: "The incentive is on its post-trigger cooldown; attestation is paused for now.",
  IncentiveNotActive: "This incentive is not active — it must pass governance first.",
  PatternMismatch: "The proof's keyword pattern doesn't match this incentive.",
  OutsideEventWindow: "This report falls outside the current round's event window.",
  EmailTooOld: "The email is older than the 30-day submission limit.",
  EmailInFuture: "The email's timestamp is in the future.",
}

function decodeError(error: unknown): string | null {
  if (!error) return null
  const e = error as { shortMessage?: string; message?: string }
  const text = e.shortMessage || e.message || String(error)
  for (const [name, msg] of Object.entries(ATTEST_ERRORS)) {
    if (text.includes(name)) return msg
  }
  return e.shortMessage || text
}

export default function AttestPage() {
  return (
    <div className="container mx-auto px-4 py-14">
      <FlowHeader
        title="Attest an Event"
        blurb="Got the newsletter? You are the oracle. Any subscriber can prove a DKIM-signed news email matches an active incentive — nothing sensitive leaves the device. Enough distinct sources within the window confirm the event and open a 10-minute dispute window."
      />
      <AttestJourney />
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
        Why this step exists: the protocol cannot read the news, so subscribers bring it the
        receipts. A single outlet could lie, which is why nothing confirms until distinct sources
        from community A, community B, <em>and</em> international wires all attest to the same
        approved pattern inside one window.
      </p>
      <ConnectGate>
        <AttestInner />
      </ConnectGate>
      <ProofExplainer />
      <HonestyNote>
        Honest limit: this demo&apos;s verifier accepts any well-formed Groth16 proof, so the
        buttons below build structurally-real proofs from the chosen domain without touching your
        inbox. Production swaps in compiled zkEmail circuits checked against real DKIM keys — the
        on-chain rules you see enforced here (approved source sets, one nullifier per email, time
        windows) are already the real thing.
      </HonestyNote>
    </div>
  )
}

/** Journey state: verified ⇒ /verify done; holding community tokens ⇒ /mint done. */
function AttestJourney() {
  const { address } = useAccount()
  const membership = useMembership()
  const isCitizen = membership.isActiveMember && membership.community !== Community.None
  const bal = useReadContract({
    ...contract.token(isCitizen ? membership.community : Community.A),
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isCitizen },
  })
  const done = [
    ...(isCitizen ? ["/verify"] : []),
    ...(((bal.data as bigint | undefined) ?? 0n) > 0n ? ["/mint"] : []),
  ]
  return <JourneyBar current="/attest" done={done} />
}

function AttestInner() {
  const { address } = useAccount()
  const membership = useMembership()

  // Pull ?incentive= from the URL once on mount.
  const [selected, setSelected] = useState<number | null>(null)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("incentive")
    if (q !== null && q !== "" && !Number.isNaN(Number(q))) setSelected(Number(q))
  }, [])

  const count = useReadContract({
    ...incentiveContract,
    functionName: "incentiveCount",
  })
  const total = Number(count.data ?? BigInt(0))

  // Incentive ids are 1-indexed (id = ++incentiveCount). Read proposalState for
  // each and keep the ones whose `active` flag is set (passed governance).
  const states = useReadContracts({
    contracts: Array.from({ length: total }, (_, i) => ({
      ...incentiveContract,
      functionName: "proposalState" as const,
      args: [BigInt(i + 1)] as const,
    })),
    query: { enabled: total > 0 },
  })

  const activeIds = useMemo(() => {
    const out: { id: number; direction: number }[] = []
    states.data?.forEach((r, i) => {
      if (r.status === "success") {
        const s = r.result as { active: boolean; direction: number }
        if (s.active) out.push({ id: i + 1, direction: Number(s.direction) })
      }
    })
    return out
  }, [states.data])

  // Default the selection to the first active incentive if none came from the URL.
  useEffect(() => {
    if (selected === null && activeIds.length > 0) setSelected(activeIds[0].id)
  }, [selected, activeIds])

  if (count.isLoading) {
    return <p className="mt-10 text-center text-muted-foreground">Loading incentives…</p>
  }
  if (total === 0 || activeIds.length === 0) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Radio className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            No active incentives to attest against yet.
          </p>
          <Link className="text-sm text-primary underline" href="/propose-incentive">
            Propose an incentive
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto mt-10 max-w-4xl space-y-6">
      <PrereqNote met={membership.isActiveMember} href="/verify" cta="Verify">
        Anyone holding the newsletter can attest — but the rewards a confirmed event unlocks are
        claimed by verified pool members only. Verify so your side of the settlement includes you.
      </PrereqNote>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" /> Choose an active incentive
          </CardTitle>
          <CardDescription>
            Only incentives that passed governance are open for attestation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {activeIds.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selected === a.id
                    ? "border-primary bg-accent/40"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium">Incentive #{a.id}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {DIRECTION_LABEL[a.direction]}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selected !== null && (
        <IncentiveAttest key={selected} incentiveId={selected} address={address} />
      )}
    </div>
  )
}

function IncentiveAttest({ incentiveId, address }: { incentiveId: number; address?: `0x${string}` }) {
  const id = BigInt(incentiveId)

  const incentive = useReadContract({
    ...incentiveContract,
    functionName: "getIncentive",
    args: [id],
  })
  const roundId = useReadContract({
    ...attestationContract,
    functionName: "currentRound",
    args: [id],
  })
  const round = useReadContract({
    ...attestationContract,
    functionName: "rounds",
    args: roundId.data !== undefined ? [id, roundId.data as bigint] : undefined,
    query: { enabled: roundId.data !== undefined },
  })

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })
  useEffect(() => {
    if (receipt.isSuccess) {
      roundId.refetch()
      round.refetch()
      incentive.refetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess])

  const inc = incentive.data as
    | { requiredA: number; requiredB: number; requiredIntl: number; attestationWindow: number }
    | undefined
  // rounds(...) has named outputs, so wagmi returns an object, not a positional tuple.
  const r = round.data as
    | { firstTs: bigint; openedAt: bigint; countA: number; countB: number; countIntl: number; status: number }
    | undefined
  const countA = r ? Number(r.countA) : 0
  const countB = r ? Number(r.countB) : 0
  const countIntl = r ? Number(r.countIntl) : 0
  const status = r ? Number(r.status) : 0 // 0 NoRound, 1 Open, 2 Confirmed, 3 Failed
  const confirmed = status === 2

  const reqA = inc ? Number(inc.requiredA) : 0
  const reqB = inc ? Number(inc.requiredB) : 0
  const reqIntl = inc ? Number(inc.requiredIntl) : 0

  const sources = demoSources()
  const grouped: Record<number, typeof sources> = {
    [SourceCategory.CommunityA]: sources.filter((s) => s.category === SourceCategory.CommunityA),
    [SourceCategory.CommunityB]: sources.filter((s) => s.category === SourceCategory.CommunityB),
    [SourceCategory.International]: sources.filter((s) => s.category === SourceCategory.International),
  }

  const [attesting, setAttesting] = useState<string | null>(null)
  const pending = isPending || receipt.isLoading

  const attest = (domain: string) => {
    if (!address) return
    reset()
    setAttesting(domain)
    writeContract({
      ...attestationContract,
      functionName: "attest",
      args: [id, buildNewsProof(domain, address, id)],
    })
  }

  const errMsg = decodeError(error)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Round progress — incentive #{incentiveId}
          </CardTitle>
          <CardDescription>
            Live from EventAttestation on Gnosis. Round #{roundId.data?.toString() ?? "—"} · window{" "}
            {inc ? `${Number(inc.attestationWindow)}s` : "—"}. A round confirms once every category
            hits its distinct-source threshold.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress label="Community A sources" have={countA} need={reqA} />
          <Progress label="Community B sources" have={countB} need={reqB} />
          <Progress label="International sources" have={countIntl} need={reqIntl} />
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Round status</span>
            <Badge variant={confirmed ? "default" : status === 3 ? "outline" : "outline"}>
              {["No round", "Open", "Confirmed", "Failed"][status] ?? "—"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {confirmed ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <p className="font-medium">Event confirmed and handed to the RedistributionEngine.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              A candidate event is now live under a <strong>10-minute dispute window</strong> (short
              for this demo — days in production). If unchallenged, the redistribution can be
              finalized to move funds through the pools.
            </p>
            <Link
              href="/pools"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline"
            >
              Go to pools to finalize <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Attest from a source
            </CardTitle>
            <CardDescription>
              Pick a newsletter you received. The demo builds a structurally-real EmailProof from
              that domain that the on-chain checks accept — one distinct domain per outlet, one
              nullifier per physical email. Need ≥{reqA} A, ≥{reqB} B, ≥{reqIntl} International.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(
              [SourceCategory.CommunityA, SourceCategory.CommunityB, SourceCategory.International] as const
            ).map((cat) => (
              <div key={cat} className="space-y-2">
                <div className="text-sm font-medium">{CATEGORY_META[cat].label}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {grouped[cat].map((s) => (
                    <TxButton
                      key={s.domain}
                      variant="outline"
                      className="h-auto justify-start whitespace-normal py-2 text-left text-xs"
                      pending={pending && attesting === s.domain}
                      disabled={pending}
                      onClick={() => attest(s.domain)}
                    >
                      <Mail className="mr-2 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="break-all">{s.domain}</span>
                    </TxButton>
                  ))}
                </div>
              </div>
            ))}

            {receipt.isSuccess && (
              <p className="rounded-lg bg-accent/40 p-3 text-sm text-accent-foreground">
                Attestation counted — round tallies updated above. Next: keep attesting from{" "}
                <em>different</em> outlets until every category meets its threshold; the round then
                confirms and hands off to the <Link href="/pools" className="font-medium text-primary underline">pools</Link>.
              </p>
            )}
            {errMsg && <p className="text-sm text-destructive">{errMsg}</p>}
            <p className="text-xs text-muted-foreground">
              Signed in as {short(address)}. Distinct-source thresholds and the per-round dedup are
              enforced on-chain; re-clicking the same outlet in one round reverts with
              DomainAlreadyCounted.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function Progress({ label, have, need }: { label: string; have: number; need: number }) {
  const met = need === 0 || have >= need
  const pct = need === 0 ? 100 : Math.min(100, (have / need) * 100)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${met ? "text-primary" : ""}`}>
          {have} / {need}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${met ? "bg-primary" : "bg-primary/50"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ProofExplainer() {
  return (
    <div className="mx-auto mt-10 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> What Goes On-Chain: the EmailProof
          </CardTitle>
          <CardDescription>
            Both proof types (citizenship and news-event) share this exact public-signal layout,
            checked by the ZKEmailVerifier contract.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DEMO_PROOF.map((row) => (
              <div
                key={row.field}
                className="grid grid-cols-1 gap-1 border-b border-border pb-3 last:border-0 md:grid-cols-[180px_1fr] md:gap-4"
              >
                <code className="font-mono text-sm text-primary">{row.field}</code>
                <div>
                  <p className="font-mono text-sm">{row.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg bg-muted p-4">
            <h4 className="font-medium">Why this beats a monitoring service</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Under the original zkTLS design, someone had to run a notary session against each news
              site while the article was live — a single choke point to censor, bribe, or DDoS. With
              zkEmail, every newsletter subscriber on earth holds durable, independently provable
              evidence, and the DKIM signature stays valid even if the article is edited or taken
              down.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

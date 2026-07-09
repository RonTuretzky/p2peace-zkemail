import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Users, Handshake, CircleDollarSign, Mail, Vote } from "lucide-react"
import { OliveBranchIcon } from "@/components/olive-branch-icon"

const FEATURES = [
  {
    icon: Mail,
    title: "zkEmail Verification",
    body: "Prove citizenship from a DKIM-signed government email, and attest world events from newsletters — all in zero knowledge, no notary, straight from your inbox.",
    href: "/verify",
    cta: "Get verified",
  },
  {
    icon: CircleDollarSign,
    title: "Reserve-Backed Peace Tokens",
    body: "Verified citizens mint 1:1; 10% of every mint stakes into a community peace pool that redistribution can touch — never your untouched savings.",
    href: "/mint",
    cta: "Mint tokens",
  },
  {
    icon: Vote,
    title: "Quadratic Dual-Majority Governance",
    body: "Propose incentives whose keyword logic is committed as an exact circuit. Verified members vote quadratically; both communities must separately agree.",
    href: "/incentives",
    cta: "See incentives",
  },
  {
    icon: Handshake,
    title: "Automatic Redistribution",
    body: "Confirmed events wait out a 48h dispute window, then move value between peace pools — paid out as an equal per-member peace dividend.",
    href: "/pools",
    cta: "View pools",
  },
]

export default function HomePage() {
  return (
    <>
      <section className="w-full py-16 md:py-24 lg:py-28">
        <div className="container mx-auto grid gap-10 px-4 lg:grid-cols-[1fr_460px] lg:gap-16">
          <div className="flex flex-col justify-center space-y-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-accent/40 px-3 py-1 text-xs font-medium text-accent-foreground">
              <OliveBranchIcon className="h-4 w-4 text-primary" />
              peer to peer to peace — live on Gnosis Chain
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl">
              Building Peace Through Economic Interdependence
            </h1>
            <p className="max-w-[600px] text-muted-foreground md:text-xl">
              A decentralized protocol for economic cooperation between citizens of conflicting
              nations — identity and events verified with zkEmail, redistribution bounded to
              opt-in peace stakes, governance that needs both sides to say yes.
            </p>
            <div className="flex flex-col gap-3 min-[400px]:flex-row">
              <Button size="lg" asChild>
                <Link href="/verify">Get Verified</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/docs">Read the Docs</Link>
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative aspect-square w-full max-w-[420px] overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/60 to-secondary p-10">
              <OliveBranchIcon className="h-full w-full text-primary/80" />
            </div>
          </div>
        </div>
      </section>

      <section className="w-full border-t border-border bg-muted/30 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              A Protocol for Economic Peacebuilding
            </h2>
            <p className="text-muted-foreground md:text-lg">
              Every flow below is wired to live contracts on Gnosis. Connect a wallet and try it.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <Card key={f.title} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display">
                      <Icon className="h-6 w-6 text-primary" />
                      {f.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between gap-4">
                    <p className="text-muted-foreground">{f.body}</p>
                    <Button variant="link" asChild className="h-auto justify-start p-0">
                      <Link href={f.href}>{f.cta} →</Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section className="w-full py-16 md:py-24">
        <div className="container mx-auto grid gap-4 px-4 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Ready to Build Peace?
          </h2>
          <p className="mx-auto max-w-[600px] text-muted-foreground md:text-lg">
            Get verified, mint into a peace pool, propose an incentive, or attest an event.
          </p>
          <div className="mx-auto mt-2 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/verify">
                <ShieldCheck className="mr-2 h-4 w-4" /> Get Verified
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/incentives">
                <Users className="mr-2 h-4 w-4" /> Browse Incentives
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

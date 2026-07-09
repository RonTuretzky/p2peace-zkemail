import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Users, Handshake, CircleDollarSign, ExternalLink } from "lucide-react"
import { OliveBranchIcon } from "@/components/olive-branch-icon"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <OliveBranchIcon className="h-6 w-6" />
            <span className="font-bold">p2p2p</span>
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link href="/#features" className="text-sm font-medium hover:underline underline-offset-4">
              Features
            </Link>
            <Link href="/user-demos" className="text-sm font-medium hover:underline underline-offset-4">
              User Demos
            </Link>
            <Link href="/attest" className="text-sm font-medium hover:underline underline-offset-4">
              Attest an Event
            </Link>
            <Link href="/docs" className="text-sm font-medium hover:underline underline-offset-4">
              Docs
            </Link>
            <Link href="/governance" className="text-sm font-medium hover:underline underline-offset-4">
              Governance
            </Link>
            <Link href="/token-economics" className="text-sm font-medium hover:underline underline-offset-4">
              Tokenomics
            </Link>
          </nav>
          <Button asChild>
            <Link href="/propose-incentive">Propose Incentive</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Building Peace Through Economic Interdependence
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    p2p2p (peer to peer to peace) is a decentralized protocol for fostering economic cooperation between
                    citizens of conflicting nations, building trust from the ground up.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button size="lg" asChild>
                    <Link href="/#features">Learn More</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/verification">Get Verified</Link>
                  </Button>
                </div>
              </div>
              <img
                src="/images/olive-branch.png"
                width="550"
                height="550"
                alt="An olive branch, symbolizing peace"
                className="mx-auto aspect-video overflow-hidden rounded-xl object-cover sm:w-full lg:order-last lg:aspect-square"
              />
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-muted">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-muted-foreground/10 px-3 py-1 text-sm">Core Features</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                  A Protocol for Economic Peacebuilding
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  p2p2p provides the tools for individuals to build economic bridges across conflict lines, creating
                  shared prosperity and mutual interest in peace.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-2 mt-12">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                    Identity & Event Verification
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-muted-foreground">
                    Using zkEmail (zero-knowledge proofs over DKIM-signed emails), citizens prove membership from a
                    government email and any newsletter subscriber can attest real-world events — without revealing an
                    email address or its contents.
                  </p>
                  <Button variant="link" asChild className="p-0 h-auto">
                    <Link href="/verification">
                      Learn about Verification <ExternalLink className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-6 w-6 text-primary" />
                    Democratic Governance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-muted-foreground">
                    Governance is identity-gated: only verified members of the two communities vote, quadratically (n
                    votes lock n² tokens), and every incentive needs a separate majority in each community.
                  </p>
                  <Button variant="link" asChild className="p-0 h-auto">
                    <Link href="/governance">
                      Explore Governance <ExternalLink className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Handshake className="h-6 w-6 text-primary" />
                    Economic Peace Incentives
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-muted-foreground">
                    Opt-in peace pools put 10% of every mint at stake against your own community's aggression, while
                    positive actions earn Treasury-funded rewards — savings outside the pool are never touched.
                  </p>
                  <Button variant="link" asChild className="p-0 h-auto">
                    <Link href="/economic-incentives">
                      See Incentives <ExternalLink className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CircleDollarSign className="h-6 w-6 text-primary" />
                    Sustainable Token Economics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-muted-foreground">
                    Two reserve-backed community tokens: citizens mint 1:1, outsiders mint at a premium that funds the
                    shared Treasury, and pool payouts are claimed equally per verified member.
                  </p>
                  <Button variant="link" asChild className="p-0 h-auto">
                    <Link href="/token-economics">
                      Understand Tokenomics <ExternalLink className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">Ready to Build Peace?</h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Become a part of the p2p2p movement. Propose an incentive, get verified, or contribute to the protocol.
              </p>
            </div>
            <div className="mx-auto w-full max-w-sm space-y-2">
              <Button size="lg" asChild>
                <Link href="/propose-incentive">Propose an Economic Incentive</Link>
              </Button>
              <p className="text-xs text-muted-foreground">Help shape the future of economic peacebuilding.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-sm text-muted-foreground">© 2025 p2p2p Initiative. All rights reserved.</p>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="#" className="text-muted-foreground hover:underline underline-offset-4">
              Terms
            </Link>
            <Link href="#" className="text-muted-foreground hover:underline underline-offset-4">
              Privacy
            </Link>
            <Link href="#" className="text-muted-foreground hover:underline underline-offset-4">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

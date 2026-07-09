import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Vote, BarChart3, Users, Scale } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function GovernancePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container flex h-16 items-center justify-between py-4">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                  Democratic Governance System
                </h1>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  A high-bandwidth democratic system for collective decision-making and accountability.
                </p>
              </div>
            </div>

            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:gap-12 mt-12">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Vote className="h-5 w-5 text-primary" />
                    <CardTitle>Voting Mechanism</CardTitle>
                  </div>
                  <CardDescription>Identity-gated quadratic voting with dual majority</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>Our governance system enables democratic decision-making through a transparent voting process:</p>
                  <ul className="space-y-2 list-disc pl-6">
                    <li>Only verified members vote — one ballot per zkEmail-proven identity</li>
                    <li>Quadratic cost: casting n votes locks n² tokens for the voting period</li>
                    <li>Dual majority: separate YES majorities required in each community</li>
                    <li>Transparent voting records on the blockchain</li>
                  </ul>
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium">How It Works</h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      Quadratic voting is only meaningful when identities are sybil-resistant — otherwise splitting
                      tokens across wallets erases the quadratic penalty. Because every voter is a verified member, n
                      votes genuinely cost n² locked tokens (returned after the vote, win or lose). A proposal passes
                      only with a majority in Community A, a majority in Community B, and at least 30% participation
                      across both — neither side can impose redistribution rules on the other.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <CardTitle>Token Redistribution</CardTitle>
                  </div>
                  <CardDescription>Opt-in peace pools create the economic incentives</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>Redistribution acts only on capital members chose to stake:</p>
                  <ul className="space-y-2 list-disc pl-6">
                    <li>10% of every mint is staked into the minter's community peace pool</li>
                    <li>Only this stake is slashable — unstaked savings are untouchable</li>
                    <li>Per-event caps, trigger limits, and cooldowns bound the response</li>
                    <li>Two-phase execution (confirm, 48h dispute, finalize) through smart contracts</li>
                  </ul>
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium">Example Scenarios</h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      If military aggression is proven via newsletter attestations, a capped share of the aggressor
                      community's pool moves to the harmed community's pool. If an act of terror occurs, the same in
                      the other direction. When positive or joint actions are proven, the shared Treasury — not the
                      counterpart's pool — pays rewards. Pool balances are claimed equally per verified member, a
                      per-citizen peace dividend.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <CardTitle>Proposal System</CardTitle>
                  </div>
                  <CardDescription>Community-driven governance proposals</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>Anyone can submit proposals for community consideration — no tokens required:</p>
                  <ul className="space-y-2 list-disc pl-6">
                    <li>No fee and no token threshold; rejected proposers wait 30 days</li>
                    <li>Structured format: pattern commitment, approved sources, thresholds, caps</li>
                    <li>Discussion period before voting begins (proposal frozen on-chain)</li>
                    <li>Activation in the IncentiveRegistry if approved</li>
                  </ul>
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium">Proposal Process</h4>
                    <ol className="list-decimal list-inside text-sm text-muted-foreground mt-2 space-y-1">
                      <li>Compile keyword logic to a zk-regex; submit with its patternHash and parameters</li>
                      <li>Community discussion period (7 days)</li>
                      <li>Quadratic voting period (3 days)</li>
                      <li>Activation if both communities approve with 30% participation</li>
                      <li>EventAttestation then accepts newsletter proofs matching the exact pattern</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-primary" />
                    <CardTitle>Checks and Balances</CardTitle>
                  </div>
                  <CardDescription>Preventing abuse and ensuring fairness</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>Our system includes checks and balances to prevent abuse:</p>
                  <ul className="space-y-2 list-disc pl-6">
                    <li>Timelocked parameter changes (48h default) via the ParamGovernor</li>
                    <li>48-hour dispute window before any redistribution finalizes</li>
                    <li>Guardian emergency pause for attestation/redistribution (never funds), auto-expiring</li>
                    <li>DisputeCouncil arbitration with members from both communities</li>
                  </ul>
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium">Safeguards</h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      Confirmed events freeze for 48 hours before funds move; during that window the DisputeCouncil
                      can reverse with a 75% supermajority. Finalized events are irreversible — courts before
                      bailiffs, and no retroactive reversals. Sensitive parameters (DKIM keys, domain allowlists,
                      redistribution caps, council membership) change only through the timelock, and a leaked DKIM
                      key can be revoked immediately by the guardian.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-12">
              <Tabs defaultValue="sanctions" className="w-full max-w-4xl mx-auto">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="sanctions">Collective Sanctions</TabsTrigger>
                  <TabsTrigger value="incentives">Economic Incentives</TabsTrigger>
                  <TabsTrigger value="projects">Joint Projects</TabsTrigger>
                </TabsList>
                <TabsContent value="sanctions" className="p-6 border rounded-lg mt-6">
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold">Collective Economic Sanctions</h3>
                    <p>
                      Both communities can approve incentives that slash the aggressor community's peace pool when
                      harmful events are proven. These are enforced through smart contracts and cannot be circumvented
                      by external pressures — but they only ever touch opt-in staked capital, never anyone's savings.
                    </p>
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium">Example Sanction Mechanisms</h4>
                      <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground mt-2">
                        <li>Pool-to-pool redistribution on finalized harmful events (capped per event)</li>
                        <li>Per-incentive trigger limits and cooldowns so recurring events cannot drain a pool</li>
                        <li>Revocation of peace-abiding business certification by member vote</li>
                        <li>Escrowed external relief tranches that simply do not release without verified progress</li>
                      </ul>
                    </div>
                    <div className="bg-muted p-4 rounded-lg mt-4">
                      <h4 className="font-medium">Example Scenarios</h4>
                      <ul className="space-y-3 list-disc pl-6 text-sm text-muted-foreground mt-2">
                        <li>
                          <strong>Aggression Prevention:</strong> If military aggression is proven, a capped share of
                          the aggressor community's pool moves to the harmed community's pool, creating an economic
                          incentive against expansion.
                        </li>
                        <li>
                          <strong>Violence Prevention:</strong> If an act of terror occurs, the responsible
                          community's pool is slashed toward the harmed community's pool, creating an economic
                          incentive against violence.
                        </li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="incentives" className="p-6 border rounded-lg mt-6">
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold">Economic Incentives</h3>
                    <p>
                      The system includes positive incentives for actions that promote peace and cooperation between
                      communities.
                    </p>
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium">Example Incentives</h4>
                      <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground mt-2">
                        <li>Treasury rewards into both pools for proven joint ventures</li>
                        <li>Cooperation bonus (Treasury-funded) on payments to certified businesses across communities</li>
                        <li>Treasury rewards for proven unilateral de-escalation steps</li>
                        <li>Sanctions-relief tranches releasing on finalized peace-building events</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="projects" className="p-6 border rounded-lg mt-6">
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold">Joint Economic Projects</h3>
                    <p>
                      Token holders can propose and fund joint economic projects that benefit both communities, creating
                      shared economic interests.
                    </p>
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium">Example Projects</h4>
                      <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground mt-2">
                        <li>Cross-border business incubators</li>
                        <li>Shared infrastructure development</li>
                        <li>Joint agricultural initiatives</li>
                        <li>Cooperative technology ventures</li>
                        <li>Cultural exchange programs</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="mt-12 text-center">
              <Button size="lg" asChild>
                <Link href="/token-economics">
                  Understand Token Economics
                  <BarChart3 className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="w-full border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-sm text-muted-foreground">© 2025 peertopeertopeace Initiative. All rights reserved.</p>
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

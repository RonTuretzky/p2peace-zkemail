import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Building, Handshake, Globe, ExternalLink, FileText, Shield, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ExternalIncentivesPage() {
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
                  Tokenized External Incentives
                </h1>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  How other nations can contribute to peace by tokenizing sanctions relief and economic incentives.
                </p>
              </div>
            </div>

            <div className="mx-auto max-w-5xl mt-12">
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Transforming Sanctions into Peace Incentives</CardTitle>
                  <CardDescription>A new approach to international economic engagement</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    The peertopeertopeace system introduces a revolutionary approach to international economic
                    engagement by allowing nations to tokenize their economic sanctions and transform them into
                    transparent, verifiable peace incentives:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Building className="h-5 w-5 text-primary" />
                        <h4 className="font-medium">Traditional Sanctions Limitations</h4>
                      </div>
                      <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground">
                        <li>Often applied broadly, harming civilian populations</li>
                        <li>Subject to political whims and inconsistent application</li>
                        <li>Lack clear, verifiable conditions for relief</li>
                        <li>Can be circumvented through various means</li>
                        <li>Often reinforce imperial power dynamics</li>
                      </ul>
                    </div>

                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Handshake className="h-5 w-5 text-primary" />
                        <h4 className="font-medium">Tokenized Incentives Advantages</h4>
                      </div>
                      <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground">
                        <li>Targeted to specific actions and outcomes</li>
                        <li>Transparent and immutable conditions</li>
                        <li>Automatically executed when conditions are verified</li>
                        <li>Resistant to political manipulation</li>
                        <li>Empower local communities rather than external powers</li>
                      </ul>
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg mt-6">
                    <h4 className="font-medium">How It Works</h4>
                    <ol className="list-decimal list-inside text-sm text-muted-foreground mt-2 space-y-2">
                      <li>
                        <strong>Tokenization:</strong> Any external party (state, NGO, diaspora) deposits reserve
                        assets into the SanctionsEscrow against a milestone — a specific incentive, a beneficiary
                        (community pool A, B, both, or the Treasury), and an expiry
                      </li>
                      <li>
                        <strong>Verification:</strong> The zkEmail attestation system proves when the referenced
                        peace-building event has occurred, via DKIM-signed newsletter proofs from approved sources
                      </li>
                      <li>
                        <strong>Automatic Execution:</strong> When the referenced event is finalized (after the
                        48-hour dispute window), the escrowed tranche releases to the beneficiary pool(s); after
                        expiry with no trigger, the donor may reclaim
                      </li>
                      <li>
                        <strong>Transparent Record:</strong> All actions and relief measures are recorded on the
                        blockchain for accountability
                      </li>
                      <li>
                        <strong>Graduated Relief:</strong> As more substantial peace-building actions occur, more
                        significant sanctions relief is unlocked
                      </li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="examples" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="examples">Implementation Examples</TabsTrigger>
                  <TabsTrigger value="technical">Technical Implementation</TabsTrigger>
                  <TabsTrigger value="governance">Governance & Oversight</TabsTrigger>
                </TabsList>
                <TabsContent value="examples" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Implementation Examples</h2>
                    <p className="mb-6">
                      Here are specific examples of how nations could tokenize sanctions relief as peace incentives:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Building className="h-5 w-5 text-primary" />
                            <CardTitle>Trade Barrier Reduction</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="border-b pb-3">
                            <h4 className="font-medium">Tariff Reduction</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Nations could create smart contracts that automatically reduce tariffs on specific exports
                              when verified demilitarization actions occur in targeted regions.
                            </p>
                          </div>
                          <div className="border-b pb-3">
                            <h4 className="font-medium">Export License Automation</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Nations could create smart contracts that automatically grant export licenses for specific
                              technologies when verified security cooperation measures are implemented.
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium">Market Access Expansion</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Nations could create smart contracts that automatically expand market access for specific
                              sectors when verified joint economic initiatives are established between conflicting
                              communities.
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Globe className="h-5 w-5 text-primary" />
                            <CardTitle>Financial System Access</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="border-b pb-3">
                            <h4 className="font-medium">Banking Relationship Restoration</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Nations could create smart contracts that automatically restore correspondent banking
                              relationships when verified transparency and anti-money laundering measures are
                              implemented.
                            </p>
                          </div>
                          <div className="border-b pb-3">
                            <h4 className="font-medium">Investment Restrictions Lifting</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Nations could create smart contracts that automatically lift investment restrictions for
                              specific sectors when verified joint business ventures are established.
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium">Financial Aid Unlocking</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Nations could create smart contracts that automatically unlock financial aid packages when
                              verified governance reforms and transparency measures are implemented.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle>Comprehensive Peace Economy Pathway</CardTitle>
                        <CardDescription>A graduated approach to full economic integration</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-4">
                          Nations could collaborate to create a comprehensive pathway to full economic integration, with
                          each peace-building milestone unlocking new levels of economic opportunity:
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                          <div className="bg-muted p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <ExternalLink className="h-5 w-5 text-primary" />
                              <h4 className="font-medium">Level 1: Basic Relief</h4>
                            </div>
                            <ul className="space-y-1 list-disc pl-6 text-sm text-muted-foreground">
                              <li>Reduction of specific tariffs</li>
                              <li>Easing of travel restrictions</li>
                              <li>Limited technology access</li>
                              <li>Basic financial services access</li>
                            </ul>
                            <p className="text-sm text-muted-foreground mt-2">
                              <strong>Triggered by:</strong> Initial security cooperation and demilitarization steps
                            </p>
                          </div>

                          <div className="bg-muted p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <ExternalLink className="h-5 w-5 text-primary" />
                              <h4 className="font-medium">Level 2: Sectoral Integration</h4>
                            </div>
                            <ul className="space-y-1 list-disc pl-6 text-sm text-muted-foreground">
                              <li>Preferential trade agreements</li>
                              <li>Expanded technology access</li>
                              <li>Investment incentives</li>
                              <li>Full financial services access</li>
                            </ul>
                            <p className="text-sm text-muted-foreground mt-2">
                              <strong>Triggered by:</strong> Substantial demilitarization and joint economic zones
                            </p>
                          </div>

                          <div className="bg-muted p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <ExternalLink className="h-5 w-5 text-primary" />
                              <h4 className="font-medium">Level 3: Full Integration</h4>
                            </div>
                            <ul className="space-y-1 list-disc pl-6 text-sm text-muted-foreground">
                              <li>Free trade agreements</li>
                              <li>Full technology access</li>
                              <li>Investment protection</li>
                              <li>International financial integration</li>
                            </ul>
                            <p className="text-sm text-muted-foreground mt-2">
                              <strong>Triggered by:</strong> Comprehensive peace agreement and sustained cooperation
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="technical" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Technical Implementation</h2>
                    <p className="mb-6">
                      The tokenization of sanctions relief requires sophisticated technical implementation to ensure
                      security, transparency, and reliability:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Smart Contract Architecture</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            The original's separate verification, escrow, execution, and audit contracts collapse
                            into one auditable primitive — the SanctionsEscrow — with zkEmail as the verification
                            layer:
                          </p>
                          <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground">
                            <li>
                              <strong>Milestones:</strong> Each deposit references an approved incentive, a
                              beneficiary (pool A, pool B, both, or Treasury), and an expiry date
                            </li>
                            <li>
                              <strong>Verification:</strong> Release conditions are exactly the protocol's own event
                              pipeline — newsletter attestations, confirmation, dispute window, finalization
                            </li>
                            <li>
                              <strong>Release:</strong> A finalized event referencing the incentive releases the
                              tranche to the beneficiary pool(s), claimable equally per verified member
                            </li>
                            <li>
                              <strong>Refund:</strong> After expiry with no finalized event, the donor reclaims the
                              deposit — everything recorded transparently on-chain
                            </li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Integration with External Systems</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            The system integrates with external systems through secure, auditable channels:
                          </p>
                          <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground">
                            <li>
                              <strong>Customs Systems:</strong> API integration with national customs systems for
                              automatic tariff adjustments
                            </li>
                            <li>
                              <strong>Export Control Systems:</strong> Secure integration with export license databases
                              for automatic approvals
                            </li>
                            <li>
                              <strong>Banking Networks:</strong> Secure messaging integration with international banking
                              networks for financial access
                            </li>
                            <li>
                              <strong>Aid Distribution Systems:</strong> Integration with aid distribution platforms for
                              automatic disbursement
                            </li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle>Security and Verification</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-medium mb-2">Multi-Source Verification</h4>
                            <p className="text-sm text-muted-foreground">
                              The system requires verification from multiple independent sources before triggering
                              sanctions relief:
                            </p>
                            <ul className="space-y-1 list-disc pl-6 text-sm text-muted-foreground mt-2">
                              <li>DKIM-signed newsletters from approved sources, proven with zkEmail by any subscriber</li>
                              <li>Distinct-source thresholds: ≥1 source per community, ≥2 international</li>
                              <li>Per-email nullifiers preventing double-counting</li>
                              <li>48-hour dispute review by the DisputeCouncil</li>
                              <li>Satellite imagery and observer oracles (future extension, out of v1 scope)</li>
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">Cryptographic Security</h4>
                            <p className="text-sm text-muted-foreground">
                              The system employs advanced cryptographic security measures:
                            </p>
                            <ul className="space-y-1 list-disc pl-6 text-sm text-muted-foreground mt-2">
                              <li>Multi-signature authorization requirements</li>
                              <li>Time-locked execution for major changes</li>
                              <li>Zero-knowledge proofs for sensitive information</li>
                              <li>Threshold cryptography for distributed trust</li>
                              <li>Immutable audit trails on the blockchain</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="governance" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Governance & Oversight</h2>
                    <p className="mb-6">
                      The tokenized sanctions relief system includes robust governance and oversight mechanisms to
                      ensure fairness, transparency, and accountability:
                    </p>

                    <Card>
                      <CardHeader>
                        <CardTitle>Governance Structure</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-muted p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-5 w-5 text-primary" />
                              <h4 className="font-medium">Transparent Conditions</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              All conditions for sanctions relief are publicly documented and immutably recorded on the
                              blockchain, ensuring that all parties understand exactly what actions will trigger relief.
                            </p>
                          </div>

                          <div className="bg-muted p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="h-5 w-5 text-primary" />
                              <h4 className="font-medium">Multi-Stakeholder Oversight</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              A diverse council of stakeholders from participating nations, local communities, and
                              independent organizations provides oversight of the system, ensuring that it operates
                              fairly and as intended.
                            </p>
                          </div>

                          <div className="bg-muted p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Shield className="h-5 w-5 text-primary" />
                              <h4 className="font-medium">Independent Verification</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Independent verification organizations ensure that peace-building actions are accurately
                              assessed and that sanctions relief is triggered appropriately, preventing manipulation or
                              false claims.
                            </p>
                          </div>
                        </div>

                        <div className="mt-6">
                          <h4 className="font-medium mb-2">Dispute Resolution</h4>
                          <p className="text-sm text-muted-foreground">
                            The system includes a robust dispute resolution mechanism to address disagreements about
                            verification or implementation.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle>Maintaining Anti-Imperialist Principles</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-4">
                          While incorporating external nations' sanctions relief as incentives, the system maintains its
                          anti-imperialist principles through several key mechanisms:
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-muted p-4 rounded-lg">
                            <h4 className="font-medium mb-2">Local Control</h4>
                            <p className="text-sm text-muted-foreground">
                              External nations can offer incentives, but cannot dictate the governance or operation of
                              the peertopeertopeace system itself. Local token holders maintain full control over the
                              core system.
                            </p>
                          </div>

                          <div className="bg-muted p-4 rounded-lg">
                            <h4 className="font-medium mb-2">Transparent Conditions</h4>
                            <p className="text-sm text-muted-foreground">
                              All conditions for sanctions relief are transparent and immutable, preventing the shifting
                              goalposts and hidden agendas that often characterize imperial economic control.
                            </p>
                          </div>
                        </div>

                        <div className="bg-muted p-4 rounded-lg mt-6">
                          <h4 className="font-medium">Transforming Power Dynamics</h4>
                          <p className="text-sm text-muted-foreground mt-2">
                            By tokenizing sanctions relief and making it conditional on verifiable peace-building
                            actions, the system transforms traditional power dynamics. Instead of sanctions being
                            wielded as opaque tools of imperial control, they become transparent incentives that empower
                            local communities to build peace on their own terms.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-12 text-center">
                <Button size="lg" asChild>
                  <Link href="/governance">Learn About Governance</Link>
                </Button>
              </div>
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

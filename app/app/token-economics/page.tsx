import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { ArrowLeft, Coins, ArrowRight, Building, TrendingUp } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export default function TokenEconomicsPage() {
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
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Token Economics</h1>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  How the peertopeertopeace system creates economic incentives for peace through innovative tokenomics.
                </p>
              </div>
            </div>

            <div className="mx-auto max-w-5xl mt-12">
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>The Dual-Token System</CardTitle>
                  <CardDescription>A bridge between separate economies with a path to integration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    The peertopeertopeace system uses a dual-token model that acknowledges the current separation of
                    conflicting economies while creating a path toward eventual integration:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Nation A Token</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Minted 1:1 against a reserve asset by zkEmail-verified citizens of Nation A, this token
                        circulates primarily within their communities but can be used for cross-border transactions.
                      </p>
                      <div className="mt-4">
                        <h4 className="text-sm font-medium">Key Features</h4>
                        <ul className="space-y-1 list-disc pl-6 text-sm text-muted-foreground mt-1">
                          <li>Reserve-backed; redeemable 1:1 while reserves last</li>
                          <li>Citizens mint 1:1 — 90% to their wallet, 10% staked into the Nation A peace pool</li>
                          <li>Only the staked pool share is exposed to redistribution</li>
                          <li>Governance gated to verified Nation A members</li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Nation B Token</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Minted 1:1 against a reserve asset by zkEmail-verified citizens of Nation B, this token
                        circulates primarily within their communities but can be used for cross-border transactions.
                      </p>
                      <div className="mt-4">
                        <h4 className="text-sm font-medium">Key Features</h4>
                        <ul className="space-y-1 list-disc pl-6 text-sm text-muted-foreground mt-1">
                          <li>Reserve-backed; redeemable 1:1 while reserves last</li>
                          <li>Citizens mint 1:1 — 90% to their wallet, 10% staked into the Nation B peace pool</li>
                          <li>Only the staked pool share is exposed to redistribution</li>
                          <li>Governance gated to verified Nation B members</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg mt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Non-Citizen Minting</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Outsiders (anyone without a citizenship proof) can also mint tokens from either nation, but at
                      a premium price (default 2×). The premium half of their payment goes to the shared Treasury —
                      global participants directly fund the positive-action rewards and cooperation bonuses.
                    </p>
                    <div className="mt-4">
                      <h4 className="text-sm font-medium">Key Features</h4>
                      <ul className="space-y-1 list-disc pl-6 text-sm text-muted-foreground mt-1">
                        <li>Premium minting cost (default 2× the citizen rate)</li>
                        <li>Same economic rights: hold, pay, redeem — but no voting, since governance is identity-gated to the two communities</li>
                        <li>Premium proceeds fund the Treasury that pays peace rewards</li>
                        <li>Supports global peace-building participation without becoming a capture vector</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="usage" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="usage">Supporting Peace-Abiding Entities</TabsTrigger>
                  <TabsTrigger value="integration">Path to Economic Integration</TabsTrigger>
                </TabsList>

                <TabsContent value="usage" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Supporting Peace-Abiding Entities</h2>
                    <p className="mb-6">
                      The peertopeertopeace system enables token holders to support businesses and citizens that abide
                      by peace principles, creating economic incentives for peace-building behavior.
                    </p>

                    <Card>
                      <CardHeader>
                        <CardTitle>Peace-Abiding Business Certification</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <p>
                            Businesses can receive "Peace-Abiding" certification by meeting specific criteria and
                            committing to peace-building principles. This certification makes them eligible to receive
                            and use peertopeertopeace tokens.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="integration" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Path to Economic Integration</h2>
                    <p className="mb-6">
                      The peertopeertopeace system is designed with a long-term vision of gradual economic integration
                      between conflicting economies, while respecting the autonomy of local communities.
                    </p>

                    <Card>
                      <CardHeader>
                        <CardTitle>Decades-Long Integration Process</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <p>
                            The system envisions a gradual, organic integration of the Nation A and Nation B tokens over
                            several decades, allowing time for trust-building and the development of shared economic
                            interests.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>

              <Card className="mt-12">
                <CardHeader>
                  <CardTitle>Engineered Negative-Sum Outcomes</CardTitle>
                  <CardDescription>
                    Applying cryptoeconomic game theory to create a "Lose/Lose" situation that accelerates peace
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <p>
                      The peertopeertopeace system incorporates advanced cryptoeconomic game theory principles to create
                      increasingly negative mutual consequences for conflict over time. This engineered "Lose/Lose"
                      situation makes peace the only rational economic choice in an otherwise hostile, trustless
                      environment.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-12">
                <CardHeader>
                  <CardTitle>Decentralization of Economic Power</CardTitle>
                  <CardDescription>
                    How token adoption gradually shifts power from centralized governments to local communities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <p>
                      As economic activity gradually shifts from traditional currencies to the peertopeertopeace system,
                      there is a corresponding shift in economic power from centralized governments to local
                      communities. This decentralization creates the foundation for rebuilding society based on
                      cryptographic consensus rather than centralized authority.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-12">
                <CardHeader>
                  <CardTitle>Token Economics Summary</CardTitle>
                  <CardDescription>Key principles of the peertopeertopeace system</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Coins className="h-5 w-5 text-primary" />
                        <h4 className="font-medium">Economic Incentives</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        The system creates powerful economic incentives for peace-building actions and disincentives for
                        conflict-causing actions, aligning individual economic interests with collective peace goals.
                      </p>
                    </div>

                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Building className="h-5 w-5 text-primary" />
                        <h4 className="font-medium">Municipal Autonomy</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Municipalities maintain autonomy over their economic decisions while having the option to
                        integrate with neighboring communities when mutually beneficial.
                      </p>
                    </div>

                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <h4 className="font-medium">Gradual Integration</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        The system supports a gradual, organic integration process that allows time for trust-building
                        and the development of shared economic interests over decades.
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-6">
                  <div className="flex justify-between items-center w-full">
                    <Button variant="outline" asChild>
                      <Link href="/governance">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Governance System
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link href="/propose-incentive">
                        Propose an Incentive
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
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

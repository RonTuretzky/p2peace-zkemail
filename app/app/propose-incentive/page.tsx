import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { ArrowLeft, FileText, Search, Newspaper, Vote, ArrowRight, Check, AlertTriangle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export default function ProposeIncentivePage() {
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
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Propose an Incentive</h1>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  How anyone can propose a conflict prevention or cooperation incentive in the peertopeertopeace system.
                </p>
              </div>
            </div>

            <div className="mx-auto max-w-5xl mt-12">
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>The Incentive Proposal Process</CardTitle>
                  <CardDescription>
                    Creating transparent, verifiable incentives for peace-building actions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    The peertopeertopeace system allows anyone — no tokens required — to propose new conflict
                    prevention or cooperation incentives. Once approved, an incentive triggers peace-pool
                    redistribution (or Treasury rewards) when the specified action is proven by zkEmail attestations
                    of DKIM-signed newsletters from the approved sources.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                    <div className="bg-muted p-4 rounded-lg flex flex-col items-center text-center">
                      <div className="bg-primary/10 p-3 rounded-full mb-3">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <h4 className="font-medium mb-2">1. Define Behavior</h4>
                      <p className="text-sm text-muted-foreground">
                        Clearly define the behavior to incentivize or disincentivize
                      </p>
                    </div>

                    <div className="bg-muted p-4 rounded-lg flex flex-col items-center text-center">
                      <div className="bg-primary/10 p-3 rounded-full mb-3">
                        <Search className="h-6 w-6 text-primary" />
                      </div>
                      <h4 className="font-medium mb-2">2. Specify Keywords</h4>
                      <p className="text-sm text-muted-foreground">
                        Define keyword logic, compiled to a zk-regex circuit and committed on-chain
                      </p>
                    </div>

                    <div className="bg-muted p-4 rounded-lg flex flex-col items-center text-center">
                      <div className="bg-primary/10 p-3 rounded-full mb-3">
                        <Newspaper className="h-6 w-6 text-primary" />
                      </div>
                      <h4 className="font-medium mb-2">3. Select News Sources</h4>
                      <p className="text-sm text-muted-foreground">
                        Specify newsletter sender domains whose DKIM-signed emails count as evidence
                      </p>
                    </div>

                    <div className="bg-muted p-4 rounded-lg flex flex-col items-center text-center">
                      <div className="bg-primary/10 p-3 rounded-full mb-3">
                        <Vote className="h-6 w-6 text-primary" />
                      </div>
                      <h4 className="font-medium mb-2">4. Community Vote</h4>
                      <p className="text-sm text-muted-foreground">
                        Verified members of both communities vote quadratically on the exact compiled pattern
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="define" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="define">Define Behavior</TabsTrigger>
                  <TabsTrigger value="keywords">Specify Keywords</TabsTrigger>
                  <TabsTrigger value="sources">Select News Sources</TabsTrigger>
                  <TabsTrigger value="voting">Voting & Implementation</TabsTrigger>
                </TabsList>

                <TabsContent value="define" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Step 1: Define the Behavior</h2>
                    <p className="mb-6">
                      The first step in proposing an incentive is to clearly define the behavior you want to incentivize
                      (cooperation) or disincentivize (conflict). This definition must be specific, measurable, and
                      objectively verifiable.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <CardTitle>Cooperation Behaviors</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="border-b pb-3">
                            <h4 className="font-medium">Demilitarization Actions</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Example: "Removal of military checkpoints in [specific region]" or "Reduction of military
                              personnel in [specific area] by [specific percentage]"
                            </p>
                          </div>
                          <div className="border-b pb-3">
                            <h4 className="font-medium">Joint Economic Initiatives</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Example: "Establishment of a joint business incubator in [specific location]" or
                              "Implementation of a shared water management system in [specific region]"
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium">Security Cooperation</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Example: "Implementation of joint security patrols in [specific area]" or "Establishment
                              of a joint crisis response center in [specific location]"
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            <CardTitle>Conflict Behaviors</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="border-b pb-3">
                            <h4 className="font-medium">Territorial Aggression</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Example: "Establishment of new military outposts in [specific area]" or "Extension of
                              security barriers into [specific region]"
                            </p>
                          </div>
                          <div className="border-b pb-3">
                            <h4 className="font-medium">Violence Against Civilians</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Example: "Attack targeting civilians in [specific location]" or "Violent actions against
                              civilian populations in [specific area]"
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium">Resource Restrictions</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Example: "Restriction of water access to [specific community]" or "Blocking of essential
                              supplies to [specific region]"
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="keywords" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Step 2: Specify Keywords</h2>
                    <p className="mb-6">
                      To ensure objective verification, you must specify keywords that must appear in newsletter
                      reports for the behavior to count as having occurred. The keyword logic is compiled off-chain
                      into a zk-regex circuit; its hash (the patternHash) is committed in your proposal, and
                      attestation proofs are only accepted if they were generated with exactly that circuit. Since
                      newsletters carry headline and lead language rather than full articles, target headline-grade
                      phrasing.
                    </p>

                    <Card>
                      <CardHeader>
                        <CardTitle>Keyword Selection Guidelines</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium">Primary Keywords</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                These are essential terms that must appear in any news report about the behavior. They
                                should be specific enough to identify the behavior but common enough to appear in
                                standard reporting.
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline" className="bg-primary/5">
                                  checkpoint removal
                                </Badge>
                                <Badge variant="outline" className="bg-primary/5">
                                  military withdrawal
                                </Badge>
                                <Badge variant="outline" className="bg-primary/5">
                                  Jordan Valley
                                </Badge>
                                <Badge variant="outline" className="bg-primary/5">
                                  IDF dismantles
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium">Location Keywords</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                These specify the exact location where the behavior occurs. Include multiple variations
                                to account for different naming conventions.
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline" className="bg-primary/5">
                                  Jordan Valley
                                </Badge>
                                <Badge variant="outline" className="bg-primary/5">
                                  West Bank
                                </Badge>
                                <Badge variant="outline" className="bg-primary/5">
                                  Route 90
                                </Badge>
                                <Badge variant="outline" className="bg-primary/5">
                                  Jericho area
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium">Action Keywords</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                These describe the specific action being taken. Include multiple variations to account
                                for different phrasing.
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline" className="bg-primary/5">
                                  removed
                                </Badge>
                                <Badge variant="outline" className="bg-primary/5">
                                  dismantled
                                </Badge>
                                <Badge variant="outline" className="bg-primary/5">
                                  withdrawn
                                </Badge>
                                <Badge variant="outline" className="bg-primary/5">
                                  eliminated
                                </Badge>
                                <Badge variant="outline" className="bg-primary/5">
                                  taken down
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium">Verification Keywords</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                These indicate that the behavior has been verified by reliable sources. They help filter
                                out speculative reporting.
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline" className="bg-primary/5">
                                  confirmed
                                </Badge>
                                <Badge variant="outline" className="bg-primary/5">
                                  verified
                                </Badge>
                                <Badge variant="outline" className="bg-primary/5">
                                  observed
                                </Badge>
                                <Badge variant="outline" className="bg-primary/5">
                                  documented
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted p-4 rounded-lg mt-6">
                          <h4 className="font-medium">Keyword Logic Requirements</h4>
                          <p className="text-sm text-muted-foreground mt-2">
                            In your proposal, you must specify the logical relationship between keywords using boolean
                            operators (AND, OR, NOT). For example:
                          </p>
                          <div className="bg-background p-3 rounded mt-2 font-mono text-sm">
                            (checkpoint removal OR military withdrawal OR IDF dismantles) AND
                            <br />
                            (Jordan Valley OR West Bank) AND
                            <br />
                            (removed OR dismantled OR withdrawn OR eliminated OR taken down) AND
                            <br />
                            (confirmed OR verified OR observed OR documented)
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            OR-groups compile to regex alternations; AND-groups become a set of regexes that must all
                            match inside the zkEmail circuit. Voters approve this exact compiled circuit, not prose —
                            the pattern cannot be reinterpreted after the vote.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle>Keyword Testing Tool</CardTitle>
                        <CardDescription>
                          Before submitting your proposal, test your compiled pattern against real newsletters
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            The peertopeertopeace tooling lets you test your pattern before committing to it:
                          </p>
                          <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground mt-2">
                            <li>Run the compiled zk-regex against a personal newsletter archive (.eml files)</li>
                            <li>See which past newsletter editions would have triggered your incentive</li>
                            <li>Refine your keywords toward headline-grade language to improve accuracy</li>
                            <li>Ensure your pattern doesn't trigger on unrelated or recurring events</li>
                          </ul>
                          <div className="mt-4 text-center">
                            <Button disabled>Access Keyword Testing Tool</Button>
                            <p className="text-xs text-muted-foreground mt-2">
                              (Available to token holders after connecting wallet)
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="sources" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Step 3: Select News Sources</h2>
                    <p className="mb-6">
                      To ensure reliable verification, you must specify which trusted news sources must report on the
                      behavior for it to trigger the incentive. Sources are newsletter sender domains (e.g.
                      newsletters.reuters.com), each tagged by category; the EventAttestation contract only counts
                      proofs whose DKIM-signed sender domain is in your approved set.
                    </p>

                    <Card>
                      <CardHeader>
                        <CardTitle>News Source Selection</CardTitle>
                        <CardDescription>
                          Choose a balanced set of trusted sources from different perspectives
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div>
                            <h4 className="font-medium mb-2">Source Requirements</h4>
                            <p className="text-sm text-muted-foreground">
                              Your proposal must include at least one source from each of these categories:
                            </p>
                            <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground mt-2">
                              <li>Israeli news sources</li>
                              <li>Palestinian news sources</li>
                              <li>International news sources</li>
                            </ul>
                            <p className="text-sm text-muted-foreground mt-2">
                              This balanced approach ensures that the behavior is recognized across different
                              perspectives and reduces the risk of biased verification.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Israeli Sources</h4>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                <li>Haaretz</li>
                                <li>The Jerusalem Post</li>
                                <li>Times of Israel</li>
                                <li>Ynet News</li>
                                <li>Israel Hayom</li>
                                <li>Kan (Israeli Public Broadcasting)</li>
                              </ul>
                            </div>

                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Palestinian Sources</h4>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                <li>Al-Quds</li>
                                <li>Ma'an News Agency</li>
                                <li>WAFA (Palestine News Agency)</li>
                                <li>Al-Ayyam</li>
                                <li>Palestine Chronicle</li>
                                <li>Al-Monitor Palestine Pulse</li>
                              </ul>
                            </div>

                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">International Sources</h4>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                <li>Reuters</li>
                                <li>Associated Press</li>
                                <li>BBC</li>
                                <li>Al Jazeera</li>
                                <li>The Guardian</li>
                                <li>France 24</li>
                                <li>Deutsche Welle</li>
                              </ul>
                            </div>
                          </div>

                          <div className="bg-muted p-4 rounded-lg">
                            <h4 className="font-medium">Verification Logic</h4>
                            <p className="text-sm text-muted-foreground mt-2">
                              In your proposal, you must specify the verification logic for news sources. For example:
                            </p>
                            <div className="bg-background p-3 rounded mt-2 font-mono text-sm">
                              (At least 1 Israeli source) AND
                              <br />
                              (At least 1 Palestinian source) AND
                              <br />
                              (At least 2 International sources)
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                              Distinct sender domains are counted per category, so a single captured newsroom (or one
                              compromised DKIM key) can never fire an event alone.
                            </p>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">Source Verification</h4>
                            <p className="text-sm text-muted-foreground">
                              The zkEmail system verifies that reports come from the actual news sources through:
                            </p>
                            <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground mt-2">
                              <li>In-circuit verification of the sender's DKIM signature against the on-chain DKIMRegistry</li>
                              <li>The DKIM-covered Date header, checked against the 7-day event window</li>
                              <li>Per-email nullifiers plus per-domain dedup — one email counts once, one outlet fills one slot</li>
                              <li>Immunity to article edits, retractions, and takedowns — the signature is frozen at send time</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle>Example: Demilitarization News Source Selection</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium">Selected News Sources</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                              <div>
                                <h5 className="text-sm font-medium">Israeli Sources (at least 1)</h5>
                                <ul className="space-y-1 text-sm text-muted-foreground mt-1">
                                  <li>Haaretz</li>
                                  <li>The Jerusalem Post</li>
                                  <li>Times of Israel</li>
                                </ul>
                              </div>
                              <div>
                                <h5 className="text-sm font-medium">Palestinian Sources (at least 1)</h5>
                                <ul className="space-y-1 text-sm text-muted-foreground mt-1">
                                  <li>Ma'an News Agency</li>
                                  <li>WAFA</li>
                                </ul>
                              </div>
                              <div>
                                <h5 className="text-sm font-medium">International Sources (at least 2)</h5>
                                <ul className="space-y-1 text-sm text-muted-foreground mt-1">
                                  <li>Reuters</li>
                                  <li>Associated Press</li>
                                  <li>BBC</li>
                                  <li>Al Jazeera</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium">Verification Logic</h4>
                            <p className="text-muted-foreground mt-1">
                              The checkpoint removal must be reported by at least 1 Israeli source, at least 1
                              Palestinian source, and at least 2 international sources, all containing the required
                              keywords.
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium">Timing Requirements</h4>
                            <p className="text-muted-foreground mt-1">
                              All reports must be published within 7 days of the first verified report to be considered
                              part of the same event.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="voting" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Step 4: Voting & Implementation</h2>
                    <p className="mb-6">
                      Once you've defined the behavior, committed the compiled pattern, and selected news sources,
                      your proposal goes through a community voting process. If approved, the incentive governs the
                      peace pools — the 10% stake every member consented to when minting — when the specified
                      behavior is proven.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Proposal Submission</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">To submit your proposal, you must include:</p>
                          <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground">
                            <li>Clear behavior definition and direction (harmful by A/B, positive by A/B, or joint)</li>
                            <li>The patternHash commitment of your compiled keyword circuit</li>
                            <li>Approved sender domains tagged by category, with distinct-source thresholds</li>
                            <li>Redistribution share (capped at 5% of a pool per event), max triggers, and cooldown</li>
                            <li>Justification for the incentive</li>
                          </ul>
                          <div className="bg-muted p-4 rounded-lg">
                            <h4 className="font-medium">Submission Requirements</h4>
                            <ul className="space-y-1 list-disc pl-6 text-sm text-muted-foreground mt-2">
                              <li>Anyone can submit a proposal without requiring token ownership</li>
                              <li>No proposal fee required to encourage broad participation</li>
                              <li>
                                Cooling period: Cannot submit a new proposal within 30 days of having a proposal
                                rejected
                              </li>
                            </ul>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Community Discussion</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Before voting begins, there is a 7-day discussion period where:
                          </p>
                          <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground">
                            <li>Members can ask questions about the proposal</li>
                            <li>The proposer can clarify intent (the on-chain proposal itself is immutable — amendments become new proposals)</li>
                            <li>Community members can express support or concerns</li>
                            <li>Experts can test the committed pattern against newsletter archives and report findings</li>
                          </ul>
                          <div className="bg-muted p-4 rounded-lg">
                            <h4 className="font-medium">Discussion Forums</h4>
                            <ul className="space-y-1 list-disc pl-6 text-sm text-muted-foreground mt-2">
                              <li>On-chain forum for transparent, permanent discussion</li>
                              <li>Live video discussions with translation services</li>
                              <li>Community calls with proposal authors</li>
                              <li>Technical review sessions for keyword and source logic</li>
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle>Voting Process</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Voting Period</h4>
                              <p className="text-sm text-muted-foreground">
                                After the 7-day discussion period, voting opens for 3 days. Only verified members can
                                vote — one ballot per zkEmail-proven identity, weight chosen by the voter at
                                quadratic cost.
                              </p>
                            </div>

                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Approval Thresholds</h4>
                              <p className="text-sm text-muted-foreground">For a proposal to pass, it must receive:</p>
                              <ul className="space-y-1 list-disc pl-6 text-sm text-muted-foreground mt-2">
                                <li>Majority support among Israeli members' vote weight</li>
                                <li>Majority support among Palestinian members' vote weight</li>
                                <li>At least 30% participation across all registered members</li>
                              </ul>
                            </div>

                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Quadratic Voting</h4>
                              <p className="text-sm text-muted-foreground">
                                Casting n votes locks n² of your community's tokens for the voting period (returned
                                afterwards, win or lose). Because identities are sybil-resistant, the quadratic cost
                                cannot be dodged by splitting tokens across wallets.
                              </p>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">The Rebalancing Agreement Is Structural</h4>
                            <p className="text-sm text-muted-foreground">
                              Consent to rebalancing is built into minting itself: the 10% peace stake taken on every
                              mint is the capital each member has explicitly put at risk against their own
                              community's aggression. Approved incentives govern how those staked pools move — never
                              anyone's unstaked savings.
                            </p>
                            <div className="bg-muted p-4 rounded-lg mt-2">
                              <h5 className="text-sm font-medium">Example Approved Incentive</h5>
                              <p className="text-sm text-muted-foreground mt-1">
                                "If military checkpoints in the Jordan Valley are removed (proven by newsletter
                                attestations from the approved sources matching the committed pattern), a reward is
                                paid from the shared Treasury into the Israeli community's peace pool, claimable
                                equally by every verified member, as a reward for this peace-building action."
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle>Implementation & Execution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">On-Chain Activation</h4>
                              <p className="text-sm text-muted-foreground">
                                Once approved, the incentive activates in the IncentiveRegistry and:
                              </p>
                              <ul className="space-y-1 list-disc pl-6 text-sm text-muted-foreground mt-2">
                                <li>EventAttestation accepts zkEmail proofs matching exactly the committed patternHash</li>
                                <li>Each proof is verified against the DKIMRegistry and the approved source set</li>
                                <li>Distinct sources are tallied per category inside the 7-day window</li>
                                <li>All attestations and state changes are recorded on-chain for transparency</li>
                              </ul>
                            </div>

                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Two-Phase Execution</h4>
                              <p className="text-sm text-muted-foreground">
                                When the specified behavior occurs and is proven:
                              </p>
                              <ol className="space-y-1 list-decimal pl-6 text-sm text-muted-foreground mt-2">
                                <li>Subscribers submit newsletter proofs until the source thresholds are met</li>
                                <li>The event becomes CONFIRMED and the affected pool amount is frozen</li>
                                <li>A 48-hour dispute window runs (council can reverse with 75%)</li>
                                <li>On FINALIZED, the pool transfer or Treasury payout executes — never before</li>
                                <li>Members claim their equal-per-member share from the receiving pool</li>
                              </ol>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">Dispute Resolution</h4>
                            <p className="text-sm text-muted-foreground">
                              If there are disputes about verification:
                            </p>
                            <ol className="space-y-1 list-decimal pl-6 text-sm text-muted-foreground mt-2">
                              <li>Any member can raise a dispute during the 48-hour window after confirmation</li>
                              <li>
                                Disputes are reviewed by the DisputeCouncil, with representatives from both
                                communities
                              </li>
                              <li>
                                A confirmed event can be reversed only by a 75% council supermajority, and only
                                inside the window — finalized events are irreversible
                              </li>
                              <li>All dispute proceedings are recorded on the blockchain for transparency</li>
                            </ol>
                          </div>

                          <div className="bg-muted p-4 rounded-lg">
                            <h4 className="font-medium">Example Execution Timeline</h4>
                            <ol className="space-y-1 list-decimal pl-6 text-sm text-muted-foreground mt-2">
                              <li>Day 1: A subscriber proves an Israeli newsletter reporting the checkpoint removal</li>
                              <li>Day 2: A Palestinian source's newsletter is proven by another subscriber</li>
                              <li>Day 3: Two international sources' alerts are proven — thresholds met</li>
                              <li>Day 3: Event CONFIRMED; the event amount is frozen in the pool</li>
                              <li>Day 3-5: 48-hour dispute window (council may reverse with 75%)</li>
                              <li>Day 5: Event FINALIZED — the payout executes and becomes irreversible</li>
                              <li>Day 5+: Verified members claim their equal-per-member share</li>
                            </ol>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>

              <Card className="mt-12">
                <CardHeader>
                  <CardTitle>Ready to Propose an Incentive?</CardTitle>
                  <CardDescription>Anyone can propose an incentive to foster peace and cooperation</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <Button size="lg" className="mr-4">
                    <FileText className="mr-2 h-4 w-4" />
                    Create New Proposal
                  </Button>
                  <Button size="lg" variant="outline">
                    <FileText className="mr-2 h-4 w-4" />
                    View Proposal Templates
                  </Button>
                </CardContent>
                <CardFooter className="flex justify-center border-t pt-6">
                  <p className="text-sm text-muted-foreground max-w-2xl text-center">
                    By proposing an incentive, you're contributing to a transparent, democratic system for
                    peace-building. All proposals are publicly visible and immutably recorded on the blockchain,
                    creating accountability for both proposers and voters.
                  </p>
                </CardFooter>
              </Card>

              <div className="mt-12 text-center">
                <Button size="lg" asChild>
                  <Link href="/governance">
                    Learn More About Governance
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
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

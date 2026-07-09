import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Handshake, AlertTriangle, Check } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function EconomicIncentivesPage() {
  return (
    <>
      <section className="container mx-auto px-4 py-14">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Economic Peace Incentives
          </h1>
          <p className="text-muted-foreground md:text-lg">
            How peer-to-peer-to-peace turns proven events into pool-to-pool redistribution and
            Treasury-funded rewards — all claimed as an equal-per-member peace dividend.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild>
              <Link href="/pools">View the peace pools</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/incentives">Browse active incentives</Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-5xl mt-12">
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>How Token Redistribution Works</CardTitle>
                  <CardDescription>The verification and implementation process</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    The peertopeertopeace system uses opt-in peace pools as its economic incentive mechanism. Every
                    mint stakes 10% of the tokens into the minter's community pool — capital explicitly consented to
                    be at risk against that community's own aggression. Minting <em>is</em> signing the rebalancing
                    agreement. For this system to work:
                  </p>
                  <ol className="space-y-2 list-decimal pl-6">
                    <li>
                      <strong>Event Verification:</strong> Events are proven with zkEmail — any subscriber submits a
                      zero-knowledge proof that a DKIM-signed newsletter from an approved source matches the
                      incentive's committed keyword pattern. Distinct-source thresholds prevent manipulation.
                    </li>
                    <li>
                      <strong>Pre-agreed Incentives:</strong> Verified members of both communities must have
                      previously approved, by dual-majority quadratic vote, the exact pattern and redistribution
                      parameters that apply to each type of event.
                    </li>
                    <li>
                      <strong>Two-Phase Execution:</strong> When attestation thresholds are met the event is
                      CONFIRMED and a 48-hour dispute window opens; only after finalization do funds move, according
                      to the pre-agreed terms (capped at 5% of a pool per event, with per-incentive trigger limits).
                    </li>
                    <li>
                      <strong>Transparent Record:</strong> All attestations, confirmations, and pool movements are
                      recorded on the blockchain, providing a transparent and immutable history.
                    </li>
                  </ol>
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium">Redistribution Principles</h4>
                    <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground mt-2">
                      <li>
                        <strong>For harmful actions:</strong> A capped share of the responsible community's peace
                        pool moves to the harmed community's pool. Only staked pool capital is exposed — nobody's
                        unstaked savings can ever be touched.
                      </li>
                      <li>
                        <strong>For positive actions:</strong> A reward is paid from the shared Treasury (funded by
                        outsider premiums and donations) into the acting community's pool — rewarding de-escalation
                        never punishes the other side.
                      </li>
                      <li>
                        <strong>For joint initiatives:</strong> The Treasury pays into both pools, rewarding
                        cooperation and shared prosperity.
                      </li>
                      <li>
                        <strong>For everyone:</strong> Pool balances are claimable by verified members on an
                        equal-per-member basis — a per-citizen peace dividend, not a transfer between whales.
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="negative" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="negative">Disincentives for Harmful Actions</TabsTrigger>
                  <TabsTrigger value="positive">Incentives for Positive Actions</TabsTrigger>
                </TabsList>
                <TabsContent value="negative" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Disincentives for Harmful Actions</h2>
                    <p className="mb-6">
                      When harmful actions occur and are proven through zkEmail attestations of DKIM-signed
                      newsletters from approved sources, a capped share of the responsible community's peace pool
                      moves to the harmed community's pool, creating a real but bounded economic cost for actions
                      that undermine peace.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            <CardTitle>Actions by Nation A</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="border-b pb-3">
                            <h4 className="font-medium">Territorial Aggression</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              If military forces from Nation A expand into Nation B's territory (proven by newsletter
                              attestations from approved sources), a share of Nation A's peace pool moves to Nation
                              B's pool.
                            </p>
                          </div>
                          <div className="border-b pb-3">
                            <h4 className="font-medium">Human Rights Violations</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              If abuse of Nation B's citizens in prisons is documented and proven, Nation A's pool is
                              slashed toward Nation B's pool at the rate the approved incentive set (capped per
                              event).
                            </p>
                          </div>
                          <div className="border-b pb-3">
                            <h4 className="font-medium">Property Destruction</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              If property destruction by Nation A's military is carried out (proven by attested
                              reports), a share of Nation A's peace pool moves to Nation B's pool.
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium">Resource Restrictions</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              If resource access restrictions are imposed on Nation B's communities (proven by
                              attested reports), a share of Nation A's peace pool moves to Nation B's pool.
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            <CardTitle>Actions by Nation B</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="border-b pb-3">
                            <h4 className="font-medium">Acts of Terrorism</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              If terror attacks on civilians occur (proven by newsletter attestations), a share of
                              Nation B's peace pool moves to Nation A's pool, at the approved per-event rate.
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium">Cross-Border Attacks</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              If rocket fire or other attacks on cities occur (proven by attested reports), a share
                              of Nation B's peace pool moves to Nation A's pool per the approved incentive.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="bg-muted p-4 rounded-lg mt-6">
                      <h4 className="font-medium">Implementation Process</h4>
                      <ol className="list-decimal list-inside text-sm text-muted-foreground mt-2 space-y-1">
                        <li>Newsletter subscribers submit zkEmail proofs of DKIM-signed reports from approved sources</li>
                        <li>EventAttestation tallies distinct sources (≥1 from each community, ≥2 international) within 7 days</li>
                        <li>Event is CONFIRMED; a 48-hour dispute window opens (council can reverse with 75%)</li>
                        <li>On finalization, the capped pool-to-pool transfer executes from the responsible community's peace pool</li>
                        <li>Members of the harmed community claim their equal-per-member share; everything is recorded on-chain</li>
                      </ol>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="positive" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Incentives for Positive Actions</h2>
                    <p className="mb-6">
                      When positive actions occur and are proven through zkEmail newsletter attestations, a reward is
                      paid from the shared Treasury (funded by outsider minting premiums and donations) into the
                      acting community's peace pool. Rewarding one side's de-escalation never comes out of the other
                      side's pool — that would manufacture grievance instead of dissolving it.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <CardTitle>Military Demilitarization</CardTitle>
                          </div>
                          <CardDescription>A key peace-building incentive</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Demilitarization of specific regions is a central peace-building incentive in the
                            peertopeertopeace system. When a nation takes steps to reduce military presence, the
                            Treasury pays a reward into that community's peace pool, claimable equally by every
                            verified member — a peace dividend for this significant concession.
                          </p>

                          <div className="bg-muted p-4 rounded-lg">
                            <h4 className="font-medium">Demilitarization Stages</h4>
                            <ul className="space-y-2 list-disc pl-6 text-sm text-muted-foreground mt-2">
                              <li>
                                <strong>Checkpoint Reduction:</strong> Removal of military checkpoints that restrict
                                civilian movement, proven by newsletter attestations from sources on both sides.
                              </li>
                              <li>
                                <strong>Troop Withdrawal:</strong> Reduction of military personnel in specific areas,
                                proven by attested reports from community and international sources.
                              </li>
                              <li>
                                <strong>Military Infrastructure Removal:</strong> Dismantling of military bases and
                                infrastructure in agreed areas, proven by attested reports.
                              </li>
                              <li>
                                <strong>Transfer to Civilian Control:</strong> Transferring security responsibilities to
                                civilian police forces, proven by attested reports and documentation.
                              </li>
                            </ul>
                          </div>

                          <div className="bg-muted p-4 rounded-lg">
                            <h4 className="font-medium">Reward Mechanism</h4>
                            <p className="text-sm text-muted-foreground mt-2">
                              For each finalized demilitarization event, the Treasury pays a reward into the acting
                              nation's peace pool, sized by the significance the approved incentive assigned. Members
                              claim it equally per person, creating a direct economic incentive for peace-building
                              steps that might otherwise be politically difficult.
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <CardTitle>Other Positive Actions</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="border-b pb-3">
                            <h4 className="font-medium">Security Cooperation</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              If authorities increase security cooperation to prevent attacks (proven by attested
                              reports), the Treasury rewards their community's peace pool.
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium">Educational Reform</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              If educational institutions implement peace-oriented curriculum reforms (proven by
                              attested reports), the Treasury rewards their community's peace pool.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="mt-6">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Handshake className="h-5 w-5 text-primary" />
                          <CardTitle>Joint Positive Actions</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="border-b pb-3">
                          <h4 className="font-medium">Joint Business Ventures</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            When entrepreneurs from both nations form joint ventures (attested through approved
                            reporting), the Treasury pays into both communities' peace pools. Certified businesses
                            also earn a Treasury-funded cooperation bonus on every cross-community payment.
                          </p>
                        </div>
                        <div className="border-b pb-3">
                          <h4 className="font-medium">Municipal Cooperation</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            When neighboring municipalities from both nations implement resource-sharing agreements
                            (proven by attested reports), the Treasury rewards both pools.
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium">Cultural Exchange Programs</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            When educational institutions from both communities establish cultural exchange programs
                            (proven by attested reports), the Treasury rewards both pools.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>

              <Card className="mt-12">
                <CardHeader>
                  <CardTitle>Democratic Agreement Process</CardTitle>
                  <CardDescription>How incentives are established and modified</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">
                    All economic peace incentives must be agreed upon by verified members of both communities through
                    a democratic voting process:
                  </p>
                  <ol className="space-y-2 list-decimal pl-6">
                    <li>
                      <strong>Proposal:</strong> Anyone can propose an incentive — no tokens required. The keyword
                      logic is compiled to a zk-regex and committed on-chain as a patternHash.
                    </li>
                    <li>
                      <strong>Discussion:</strong> A 7-day discussion period allows for debate; the on-chain proposal
                      is immutable, so amendments become new proposals.
                    </li>
                    <li>
                      <strong>Voting:</strong> Verified members of both communities vote quadratically for 3 days (n
                      votes lock n² tokens).
                    </li>
                    <li>
                      <strong>Implementation:</strong> The incentive activates only with a separate majority in each
                      community plus 30% participation across both.
                    </li>
                    <li>
                      <strong>Review:</strong> Incentives carry trigger caps and cooldowns, and can be superseded by
                      new proposals through the same process.
                    </li>
                  </ol>
                  <div className="bg-muted p-4 rounded-lg mt-4">
                    <p className="text-sm text-muted-foreground">
                      This democratic process ensures that economic peace incentives reflect the shared values and
                      priorities of both communities, preventing one-sided or unfair mechanisms.
                    </p>
                  </div>
                </CardContent>
              </Card>

          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/pools">View the Peace Pools</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/governance">Learn About Governance</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, User, Vote, FileText, Globe, CheckCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export default function UserDemosPage() {
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
                  User Flow Demonstrations
                </h1>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Step-by-step demonstrations of all user actions in the peertopeertopeace system.
                </p>
              </div>
            </div>

            <div className="mx-auto max-w-5xl mt-12">
              <Tabs defaultValue="verification" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="verification">Identity Verification</TabsTrigger>
                  <TabsTrigger value="minting">Token Minting</TabsTrigger>
                  <TabsTrigger value="proposing">Propose Incentive</TabsTrigger>
                  <TabsTrigger value="voting">Voting</TabsTrigger>
                  <TabsTrigger value="business">Business Actions</TabsTrigger>
                  <TabsTrigger value="redistribution">Token Redistribution</TabsTrigger>
                </TabsList>

                <TabsContent value="verification" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Identity Verification Flow</h2>
                    <p className="mb-6">
                      How users verify their citizenship to participate in the peertopeertopeace system.
                    </p>

                    <div className="space-y-6">
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-800">Step 1</Badge>
                            <CardTitle>Find a Government Email</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="font-medium">User Actions</h4>
                              <ol className="space-y-2 list-decimal pl-6 text-sm">
                                <li>Search your inbox for a DKIM-signed government email (tax receipt, ID-portal confirmation, health-fund notice)</li>
                                <li>Check the sender domain is on your community's allowlist</li>
                                <li>Confirm the email is at most 90 days old (proof freshness window)</li>
                                <li>Download it as a raw .eml file and connect your wallet</li>
                              </ol>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Why This Works</h4>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                <li>• Governments already DKIM-sign outgoing mail — no cooperation needed</li>
                                <li>• The signature covers sender, recipient, date, and body</li>
                                <li>• The allowlist maps each government domain to a community</li>
                                <li>• No document upload, biometrics, or verification server exists</li>
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-800">Step 2</Badge>
                            <CardTitle>Generate the Proof Client-Side</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="font-medium">User Actions</h4>
                              <ol className="space-y-2 list-decimal pl-6 text-sm">
                                <li>Load the .eml into the in-browser prover (zk-email SDK)</li>
                                <li>The citizenship blueprint for the domain is fetched by its patternHash</li>
                                <li>Wait ~10–60 seconds while the WASM prover runs on your machine</li>
                                <li>Review the public signals before submitting anything</li>
                              </ol>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">What the Circuit Proves</h4>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                <li>• The DKIM RSA signature verifies against the registered key</li>
                                <li>• The from-domain and government notice template match</li>
                                <li>• Nullifier = Poseidon(your address, salt) — the address itself stays private</li>
                                <li>• The email never leaves your device; only public signals do</li>
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800">Step 3</Badge>
                            <CardTitle>Register On-Chain</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="font-medium">User Experience</h4>
                              <ol className="space-y-2 list-decimal pl-6 text-sm">
                                <li>Submit the EmailProof to IdentityRegistry.register (or let a relayer submit it gaslessly — the proof binds your wallet)</li>
                                <li>Enrollment is instant once the transaction confirms</li>
                                <li>Membership lasts 365 days, renewable with a fresh proof from the same inbox</li>
                                <li>You can now mint at 1:1, vote, and claim pool rewards</li>
                              </ol>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">System Actions</h4>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                <li>• ZKEmailVerifier checks the DKIM key in the DKIMRegistry and verifies the Groth16 proof</li>
                                <li>• The nullifier is consumed — one registration per government-known inbox</li>
                                <li>• Wallet enrolled in the community roll (counts toward quorum math)</li>
                                <li>• Lost keys? The same nullifier with a fresh proof can rotate the wallet</li>
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="minting" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Token Minting Flow</h2>
                    <p className="mb-6">How users mint tokens to participate in the peertopeertopeace economy.</p>

                    <div className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Citizen vs Non-Citizen Minting</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <h4 className="font-medium text-green-800">Verified Citizens</h4>
                              </div>
                              <ul className="space-y-2 text-sm text-green-700">
                                <li>• Mint at 1:1 rate against the reserve asset</li>
                                <li>• 90% to your wallet, 10% staked into your community's peace pool</li>
                                <li>• Full governance rights (identity-gated)</li>
                                <li>• Equal-per-member claims on pool rewards</li>
                              </ul>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Globe className="h-5 w-5 text-orange-600" />
                                <h4 className="font-medium text-orange-800">Non-Citizens</h4>
                              </div>
                              <ul className="space-y-2 text-sm text-orange-700">
                                <li>• Mint at a premium (default 2× the citizen rate)</li>
                                <li>• Premium half of the payment funds the shared Treasury</li>
                                <li>• Same economic rights, but no voting (governance needs identity)</li>
                                <li>• Support global peace-building</li>
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-800">Citizen Flow</Badge>
                            <CardTitle>Verified Citizen Minting Process</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">1. Select Amount</h4>
                                <p className="text-sm text-muted-foreground">
                                  Choose how much reserve asset to convert to your community's PeaceToken
                                </p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">2. Membership Check</h4>
                                <p className="text-sm text-muted-foreground">
                                  PeaceMinter checks your zkEmail registration in the IdentityRegistry for the 1:1 rate
                                </p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">3. Mint with 90/10 Split</h4>
                                <p className="text-sm text-muted-foreground">
                                  90% of tokens go to your wallet; 10% is staked into your community pool as your
                                  peace stake — the only capital exposed to redistribution
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-orange-100 text-orange-800">Non-Citizen Flow</Badge>
                            <CardTitle>Non-Citizen Minting Process</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">1. Choose Nation</h4>
                                <p className="text-sm text-muted-foreground">
                                  Select which community's tokens to mint (Israeli or Palestinian)
                                </p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">2. Pay Premium</h4>
                                <p className="text-sm text-muted-foreground">
                                  Pay 2× the citizen rate in the reserve asset (no identity proof needed)
                                </p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">3. Premium to Treasury</h4>
                                <p className="text-sm text-muted-foreground">
                                  Tokens mint 1:1 against half your payment; the premium half funds the shared
                                  Treasury that pays peace rewards
                                </p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">4. Receive Tokens</h4>
                                <p className="text-sm text-muted-foreground">
                                  Full economic rights: hold, pay, redeem — voting stays with verified members
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="proposing" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Incentive Proposal Flow</h2>
                    <p className="mb-6">How users propose new economic incentives for peace-building actions.</p>

                    <div className="space-y-6">
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-purple-100 text-purple-800">Phase 1</Badge>
                            <CardTitle>Proposal Creation</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="font-medium">User Actions</h4>
                              <ol className="space-y-2 list-decimal pl-6 text-sm">
                                <li>Access proposal creation interface</li>
                                <li>Define specific behavior to incentivize/disincentivize</li>
                                <li>Specify keyword combinations for verification</li>
                                <li>Select trusted news sources for verification</li>
                                <li>Set token redistribution parameters</li>
                                <li>Write justification and impact analysis</li>
                                <li>Submit proposal to community</li>
                              </ol>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Example: Checkpoint Removal</h4>
                              <div className="space-y-2 text-sm text-muted-foreground">
                                <p>
                                  <strong>Behavior:</strong> Military checkpoint removal in Jordan Valley (positive, by A)
                                </p>
                                <p>
                                  <strong>Pattern:</strong> "checkpoint removal" AND "Jordan Valley" — compiled to a
                                  zk-regex, committed as patternHash
                                </p>
                                <p>
                                  <strong>Sources:</strong> haaretz.co.il (A), maannews.net (B), reuters.com + apnews.com (Intl)
                                </p>
                                <p>
                                  <strong>Payout:</strong> Treasury reward into the Israeli community's peace pool,
                                  claimed equally per member
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-purple-100 text-purple-800">Phase 2</Badge>
                            <CardTitle>Community Discussion</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="font-medium">7-Day Discussion Period</h4>
                              <ul className="space-y-2 list-disc pl-6 text-sm">
                                <li>Proposal published to community forum</li>
                                <li>Token holders ask questions and provide feedback</li>
                                <li>Proposer can clarify and make modifications</li>
                                <li>Technical review of keyword logic</li>
                                <li>Impact assessment by community experts</li>
                              </ul>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Discussion Tools</h4>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                <li>• On-chain forum for permanent record</li>
                                <li>• Live video calls with translation</li>
                                <li>• Keyword testing tool</li>
                                <li>• Historical event analysis</li>
                                <li>• Community sentiment polling</li>
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800">Phase 3</Badge>
                            <CardTitle>Proposal Finalization</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Final Review</h4>
                                <p className="text-sm text-muted-foreground">
                                  Proposer incorporates feedback and submits final version
                                </p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Technical Validation</h4>
                                <p className="text-sm text-muted-foreground">
                                  System validates keyword logic and news source availability
                                </p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Voting Preparation</h4>
                                <p className="text-sm text-muted-foreground">
                                  Proposal moves to voting phase with all parameters locked
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="voting" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Governance Voting Flow</h2>
                    <p className="mb-6">How token holders vote on proposals and participate in governance.</p>

                    <div className="space-y-6">
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-800">Step 1</Badge>
                            <CardTitle>Voting Access</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="font-medium">Voter Requirements</h4>
                              <ul className="space-y-2 list-disc pl-6 text-sm">
                                <li>Must be a verified member (zkEmail citizenship proof, unexpired)</li>
                                <li>One ballot per identity — outsider capital cannot vote</li>
                                <li>Must hold enough PeaceTokens to cover the quadratic lock</li>
                                <li>Tokens are locked only for the 3-day voting period</li>
                              </ul>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Voting Power Calculation</h4>
                              <p className="text-sm text-muted-foreground">
                                Quadratic voting: casting n votes locks n² tokens (returned after the vote)
                              </p>
                              <div className="mt-2 text-xs text-muted-foreground">
                                <p>1 vote = 1 token</p>
                                <p>2 votes = 4 tokens</p>
                                <p>3 votes = 9 tokens</p>
                                <p>4 votes = 16 tokens</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-800">Step 2</Badge>
                            <CardTitle>Casting Votes</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="font-medium">Voting Process</h4>
                              <ol className="space-y-2 list-decimal pl-6 text-sm">
                                <li>Review the proposal — including the exact committed pattern and parameters</li>
                                <li>Select number of votes to cast (considering the n² lock)</li>
                                <li>Choose position: For or Against</li>
                                <li>Confirm the token lock for the voting period</li>
                                <li>Submit the vote on-chain</li>
                              </ol>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Why the Lock Matters</h4>
                              <p className="text-sm text-muted-foreground mb-2">
                                Strong preferences cost real, temporarily illiquid capital
                              </p>
                              <ul className="space-y-1 text-xs text-muted-foreground">
                                <li>• Locked tokens are returned win or lose</li>
                                <li>• Splitting tokens across wallets doesn't help — ballots are per identity</li>
                                <li>• Vote weight counts toward your community's tally only</li>
                                <li>• Participation counts toward the 30% joint quorum</li>
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800">Step 3</Badge>
                            <CardTitle>Vote Counting & Results</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Approval Requirements</h4>
                                <ul className="space-y-1 text-sm text-muted-foreground">
                                  <li>• Majority of Israeli members' vote weight</li>
                                  <li>• Majority of Palestinian members' vote weight</li>
                                  <li>• Minimum 30% participation of registered members</li>
                                </ul>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Vote Tallying</h4>
                                <ul className="space-y-1 text-sm text-muted-foreground">
                                  <li>• Tallied per community, on-chain</li>
                                  <li>• Weight n from an n² token lock</li>
                                  <li>• All locks released at tally</li>
                                </ul>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Implementation</h4>
                                <ul className="space-y-1 text-sm text-muted-foreground">
                                  <li>• Incentive activates in the IncentiveRegistry</li>
                                  <li>• EventAttestation starts accepting matching proofs</li>
                                  <li>• Rejected proposals: proposer waits 30 days</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="business" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Business Integration Flow</h2>
                    <p className="mb-6">How businesses integrate with peertopeertopeace to receive and use tokens.</p>

                    <div className="space-y-6">
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800">Step 1</Badge>
                            <CardTitle>Peace-Abiding Certification</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="font-medium">Certification Requirements</h4>
                              <ul className="space-y-2 list-disc pl-6 text-sm">
                                <li>No involvement in activities that undermine peace</li>
                                <li>Commitment to non-discrimination policies</li>
                                <li>Willingness to serve customers from both communities</li>
                                <li>Transparent business practices</li>
                                <li>Regular compliance reporting</li>
                              </ul>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Application Process</h4>
                              <ol className="space-y-1 text-sm text-muted-foreground">
                                <li>1. Apply on-chain with the business wallet + metadata URI</li>
                                <li>2. Complete peace-abiding commitment form</li>
                                <li>3. 3-day member vote (simple majority of each community roll)</li>
                                <li>4. Receive certification if approved</li>
                                <li>5. Certification is revocable by the same vote</li>
                              </ol>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800">Step 2</Badge>
                            <CardTitle>Token Integration</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="font-medium">Technical Integration</h4>
                              <ul className="space-y-2 list-disc pl-6 text-sm">
                                <li>Install peertopeertopeace payment gateway</li>
                                <li>Configure token acceptance rates</li>
                                <li>Set up automatic conversion to local currency</li>
                                <li>Implement customer verification system</li>
                                <li>Enable cross-border transaction processing</li>
                              </ul>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Business Benefits</h4>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                <li>• Access to cross-border customers</li>
                                <li>• Reduced transaction fees</li>
                                <li>• Marketing as peace-supporting business</li>
                                <li>• Eligibility for cooperation bonuses</li>
                                <li>• Priority in joint venture opportunities</li>
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-800">Step 3</Badge>
                            <CardTitle>Cross-Border Transactions</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Customer Payment</h4>
                                <p className="text-sm text-muted-foreground">
                                  Customer calls payBusiness with PeaceTokens from their wallet
                                </p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Certification Check</h4>
                                <p className="text-sm text-muted-foreground">
                                  The token contract checks the BusinessRegistry certification and communities
                                </p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Cooperation Bonus</h4>
                                <p className="text-sm text-muted-foreground">
                                  If payer and business are from different communities, the Treasury adds a bonus to
                                  the business
                                </p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Currency Conversion</h4>
                                <p className="text-sm text-muted-foreground">
                                  Business can convert tokens to local currency if desired
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="redistribution" className="mt-6 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">Peace-Pool Redistribution Flow</h2>
                    <p className="mb-6">
                      How proven events move value between the opt-in peace pools — never anyone's unstaked savings.
                    </p>

                    <div className="space-y-6">
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-red-100 text-red-800">Trigger Event</Badge>
                            <CardTitle>Permissionless Attestation</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="font-medium">Anyone With the Newsletter Can Attest</h4>
                              <ul className="space-y-2 list-disc pl-6 text-sm">
                                <li>Subscribers save the DKIM-signed newsletter reporting the event as .eml</li>
                                <li>Each generates a zkEmail proof against the incentive's committed pattern</li>
                                <li>Proofs are submitted to EventAttestation — no monitoring service exists</li>
                                <li>Per-email nullifiers stop double-counting; per-domain dedup stops digest spam</li>
                              </ul>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Example Attestation</h4>
                              <div className="space-y-2 text-sm text-muted-foreground">
                                <p>
                                  <strong>Event:</strong> Military checkpoint removed in Jordan Valley
                                </p>
                                <p>
                                  <strong>Sources proven:</strong> Haaretz, Ma'an News, Reuters, AP newsletters
                                </p>
                                <p>
                                  <strong>Pattern:</strong> Matches the incentive's committed patternHash
                                </p>
                                <p>
                                  <strong>Status:</strong> Tallying distinct sources within the 7-day window
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-yellow-100 text-yellow-800">Verification</Badge>
                            <CardTitle>zkEmail Verification Process</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="font-medium">Multi-Source Verification</h4>
                              <ol className="space-y-2 list-decimal pl-6 text-sm">
                                <li>Each proof verifies the sender's DKIM signature against the DKIMRegistry</li>
                                <li>The DKIM-covered Date header must fall inside the event window</li>
                                <li>The sender domain must be in the incentive's approved source set</li>
                                <li>Distinct domains are tallied per category (A / B / International)</li>
                                <li>Evidence is immune to article edits and takedowns — signatures froze at send time</li>
                              </ol>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Verification Timeline</h4>
                              <div className="space-y-2 text-sm text-muted-foreground">
                                <p>
                                  <strong>Day 1:</strong> Israeli-source newsletter proven (1 of 1 required)
                                </p>
                                <p>
                                  <strong>Day 2:</strong> Palestinian-source newsletter proven (1 of 1 required)
                                </p>
                                <p>
                                  <strong>Day 3:</strong> Two international sources proven (2 of 2 required)
                                </p>
                                <p>
                                  <strong>Day 3:</strong> Thresholds met — event CONFIRMED
                                </p>
                                <p>
                                  <strong>Status:</strong> 48-hour dispute window opens, amount frozen
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-purple-100 text-purple-800">Dispute Window</Badge>
                            <CardTitle>48 Hours Before Any Funds Move</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="font-medium">Courts Before Bailiffs</h4>
                              <ul className="space-y-2 list-disc pl-6 text-sm">
                                <li>Any member can raise a dispute about a confirmed event</li>
                                <li>Disputes reviewed by the DisputeCouncil (both communities represented)</li>
                                <li>Evidence must be provided for dispute claims</li>
                                <li>75% council supermajority required to reverse — and only inside the window</li>
                              </ul>
                            </div>
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Dispute Outcomes</h4>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                <li>
                                  • <strong>Reversed (75%):</strong> Event voided, frozen amount released, no funds move
                                </li>
                                <li>
                                  • <strong>No reversal:</strong> Event FINALIZED after 48h — irreversible
                                </li>
                                <li>
                                  • <strong>After finalization:</strong> No retroactive reversals, ever — payouts stay certain
                                </li>
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800">Execution</Badge>
                            <CardTitle>Pool Transfer & Peace Dividend</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Harmful Events</h4>
                                <p className="text-sm text-muted-foreground">
                                  The RedistributionEngine slashes the capped share from the aggressor community's
                                  pool corpus and credits the harmed community's pool at par value
                                </p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Positive & Joint Events</h4>
                                <p className="text-sm text-muted-foreground">
                                  Rewards are paid from the shared Treasury into the acting pool(s) — never taken
                                  from the counterpart community
                                </p>
                              </div>
                              <div className="bg-muted p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Equal-Per-Member Claims</h4>
                                <p className="text-sm text-muted-foreground">
                                  The receiving pool's reward-per-member accumulator increases; every verified member
                                  claims the same amount
                                </p>
                              </div>
                            </div>

                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-medium mb-2">Example Redistribution (harmful event by A)</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                                <div>
                                  <p>
                                    <strong>Event:</strong> Cross-border attack, finalized after dispute window
                                  </p>
                                  <p>
                                    <strong>Redistribution:</strong> 5% of pool A's corpus (the per-event cap)
                                  </p>
                                  <p>
                                    <strong>Direction:</strong> Pool A → Pool B
                                  </p>
                                  <p>
                                    <strong>Exposure:</strong> Only opted-in peace stakes — no wallet balances
                                  </p>
                                </div>
                                <div>
                                  <p>
                                    <strong>Pool A corpus:</strong> 1,000,000 tokens
                                  </p>
                                  <p>
                                    <strong>Amount moved:</strong> 50,000 tokens of value, minted at par into pool B rewards
                                  </p>
                                  <p>
                                    <strong>Per verified B member:</strong> Equal share (e.g. 10,000 members → 5 tokens each)
                                  </p>
                                  <p>
                                    <strong>Escrow effect:</strong> SanctionsEscrow tranches referencing this incentive release
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <Card className="mt-12">
                <CardHeader>
                  <CardTitle>Interactive Demo Environment</CardTitle>
                  <CardDescription>Experience these flows in our sandbox environment</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Button variant="outline" className="h-auto p-4 bg-transparent">
                      <div className="flex flex-col items-center gap-2">
                        <User className="h-6 w-6" />
                        <span>Try Identity Verification</span>
                      </div>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 bg-transparent">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-6 w-6" />
                        <span>Create Sample Proposal</span>
                      </div>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 bg-transparent">
                      <div className="flex flex-col items-center gap-2">
                        <Vote className="h-6 w-6" />
                        <span>Simulate Voting</span>
                      </div>
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    All demos run in a safe sandbox environment with test tokens and simulated events.
                  </p>
                </CardContent>
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

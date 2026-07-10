import { keccak256, toBytes, encodeAbiParameters, parseAbiParameters } from "viem"
import { Community, SourceCategory } from "./chains"

/**
 * Demo proof fixtures. The Gnosis deployment was broadcast with DEMO_SETUP=true,
 * which routes both blueprints to a MockGroth16Verifier that accepts any Groth16
 * proof — so the frontend can build a *structurally real* EmailProof (correct
 * DKIM key hash, allowlisted domain, committed pattern, fresh timestamp) that
 * passes every on-chain contract check without a WASM prover. This is what makes
 * the live end-to-end demo clickable. In production the mock is swapped for
 * compiled per-blueprint verifiers and these builders are replaced by the
 * zk-email SDK (see circuits/proving-example.ts).
 */

// keccak256(lowercase domain) — must match Deploy.s.sol demoDomains().
const domainHash = (d: string) => keccak256(toBytes(d))

/**
 * Real-world demo domains (registered on the live deployment):
 *  - govA: btl.gov.il — Israeli National Insurance Institute (sends from
 *    noreply@btl.gov.il — the email virtually every Israeli resident receives)
 *  - govB: gov.ps — Palestinian Authority portal
 *  - newsA: timesofisrael.com — Times of Israel "Daily Edition" email newsletter
 *  - newsB: wafa.ps — WAFA, Palestine News Agency
 *  - intl: reuters.com, apnews.com — both run daily email briefings
 */
export const DEMO_DOMAINS = {
  govA: "btl.gov.il",
  govB: "gov.ps",
  newsA: ["timesofisrael.com"],
  newsB: ["wafa.ps"],
  intl: ["reuters.com", "apnews.com"],
} as const

export const CITIZENSHIP_PATTERN = keccak256(toBytes("p2peace/citizenship-v1"))
export const NEWS_PATTERN = keccak256(toBytes("p2peace/news-event-v1:demo-keywords"))

/** DKIM key hash for a demo domain: keccak256(abi.encode("dkim-key", domainHash)). */
function demoKey(domain: string): `0x${string}` {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("string, bytes32"), ["dkim-key", domainHash(domain)]),
  )
}

const ZERO8 = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const

export interface EmailProofStruct {
  dkimPubkeyHash: `0x${string}`
  domainHash: `0x${string}`
  nullifier: `0x${string}`
  patternHash: `0x${string}`
  emailTimestamp: bigint
  proof: readonly bigint[]
}

/** Freshly-dated timestamp (60s in the past) that satisfies every freshness check. */
export function freshTimestamp(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) - 60)
}

/**
 * Citizenship proof for a wallet. The nullifier stands in for
 * Poseidon(recipientAddress, salt); we derive a stable per-wallet value so each
 * wallet is one identity. `communityDomain` picks which government the "email"
 * is from (and therefore the community).
 */
export function buildCitizenshipProof(
  wallet: `0x${string}`,
  community: Community,
  timestamp = freshTimestamp(),
): EmailProofStruct {
  const domain = community === Community.A ? DEMO_DOMAINS.govA : DEMO_DOMAINS.govB
  const nullifier = keccak256(
    encodeAbiParameters(parseAbiParameters("string, address"), ["p2peace-demo-id", wallet]),
  )
  return {
    dkimPubkeyHash: demoKey(domain),
    domainHash: domainHash(domain),
    nullifier,
    patternHash: CITIZENSHIP_PATTERN,
    emailTimestamp: timestamp,
    proof: ZERO8,
  }
}

/**
 * News-event proof from `domain` for an incentive. The nullifier stands in for
 * Poseidon(dkimSignature) — unique per physical email — so we mix in the wallet
 * and incentive to let a user attest each distinct source exactly once.
 */
export function buildNewsProof(
  domain: string,
  wallet: `0x${string}`,
  incentiveId: bigint,
  timestamp = freshTimestamp(),
): EmailProofStruct {
  const nullifier = keccak256(
    encodeAbiParameters(parseAbiParameters("string, address, uint256, string"), [
      "p2peace-demo-email",
      wallet,
      incentiveId,
      domain,
    ]),
  )
  return {
    dkimPubkeyHash: demoKey(domain),
    domainHash: domainHash(domain),
    nullifier,
    patternHash: NEWS_PATTERN,
    emailTimestamp: timestamp,
    proof: ZERO8,
  }
}

/** All demo sources with their category, for building/attesting incentives. */
export function demoSources(): { domain: string; category: SourceCategory; label: string }[] {
  return [
    ...DEMO_DOMAINS.newsA.map((d) => ({ domain: d, category: SourceCategory.CommunityA, label: d })),
    ...DEMO_DOMAINS.newsB.map((d) => ({ domain: d, category: SourceCategory.CommunityB, label: d })),
    ...DEMO_DOMAINS.intl.map((d) => ({ domain: d, category: SourceCategory.International, label: d })),
  ]
}

export const domainHashOf = domainHash

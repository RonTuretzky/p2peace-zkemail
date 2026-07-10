import { gnosis } from "wagmi/chains"

/**
 * The demo runs on Gnosis Chain (100): cheap, fast, and the same chain the
 * Breadchain / crowdstake deployments target.
 */
export const ACTIVE_CHAIN = gnosis
export const ACTIVE_CHAIN_ID = gnosis.id

/**
 * The live deployment uses REAL sDAI on Gnosis as its reserve — there is no
 * faucet. Small amounts only: identity/event proofs run on a demo verifier.
 */
/** SavingsXDaiAdapter on Gnosis: depositXDAI{value}(receiver) wraps xDAI → sDAI in one tx. */
export const SAVINGS_XDAI_ADAPTER = "0xD499b51fcFc66bd31248ef4b28d656d67E591A94" as const

export const RESERVE = {
  symbol: "sDAI",
  isMock: false,
  getUrl: "https://swap.cow.fi/#/100/swap/XDAI/sDAI",
} as const

/** The eight core contracts a page ever touches, keyed by role. */
export interface ContractAddresses {
  reserveToken: `0x${string}`
  dkimRegistry: `0x${string}`
  zkEmailVerifier: `0x${string}`
  mockGroth16Verifier: `0x${string}`
  identityRegistry: `0x${string}`
  peaceTokenA: `0x${string}`
  peaceTokenB: `0x${string}`
  treasury: `0x${string}`
  communityPoolA: `0x${string}`
  communityPoolB: `0x${string}`
  peaceMinterA: `0x${string}`
  peaceMinterB: `0x${string}`
  incentiveRegistry: `0x${string}`
  eventAttestation: `0x${string}`
  redistributionEngine: `0x${string}`
  sanctionsEscrow: `0x${string}`
  realEmailVerifier: `0x${string}`
}

/**
 * Baked-in fallback addresses (Deploy.s.sol broadcast to Gnosis with DEMO_SETUP).
 * These are mutated in place by hydrateRemoteAddresses() when a newer manifest is
 * published, so a redeploy goes live without a frontend rebuild (crowdstake
 * convention). Treat this object as the single source module-level captures read.
 */
export const ADDRESSES: ContractAddresses = {
  reserveToken: "0xaf204776c7245bf4147c2612bf6e5972ee483701",
  dkimRegistry: "0x0aae0d2af6f73d3034490e4bbb17e897c57ae977",
  zkEmailVerifier: "0xd43380d3639096a2450b1e0ef235b4ddca8796f8",
  mockGroth16Verifier: "0xaed7cf0fd62b547a02309b134a2cc89d053b2019",
  identityRegistry: "0xab8758312f4dc3f50abb7f52ca4e65ecd19bd268",
  peaceTokenA: "0x63be2cee6cb79bd4ff960e1c8a2b58514f033c1b",
  peaceTokenB: "0x0b05d93822145f2f74dd59e10653fbd6a30d14b4",
  treasury: "0x63f166ab322cd26b195a57fe283284a5d8adb186",
  communityPoolA: "0x12785f81624e8c303f2b8dfba33d1e88d7fbf5d1",
  communityPoolB: "0xf31599c4ec89cae2ff26265e53e7508bce5af0c0",
  peaceMinterA: "0xe4e5456878f4760e75a56ce2c657c27b4fd54d2d",
  peaceMinterB: "0x9c76dfa376bd2ed0ce14c90e09e31425ece42b42",
  incentiveRegistry: "0x2d552aac74e5229240dcf727d6edc3e2c3a3f42d",
  eventAttestation: "0x7150d600cf922eec337f0a0ada14b525f0dd530d",
  redistributionEngine: "0x241a51c7f3394538c883dce28af433c6908ce032",
  sanctionsEscrow: "0x4f931f24462d4b53a0475c98a00cad74d32d0a70",
  realEmailVerifier: "0x0e707f9e969c0b61d48e9efb62fbecf54e628a8b",
}

/** Community enum (mirrors src/Types.sol Community). */
export enum Community {
  None = 0,
  A = 1,
  B = 2,
}

/** Direction enum (mirrors src/Types.sol Direction). */
export enum Direction {
  HarmfulByA = 0,
  HarmfulByB = 1,
  PositiveForA = 2,
  PositiveForB = 3,
  Joint = 4,
}

/** SourceCategory enum (mirrors src/Types.sol SourceCategory). */
export enum SourceCategory {
  None = 0,
  CommunityA = 1,
  CommunityB = 2,
  International = 3,
}

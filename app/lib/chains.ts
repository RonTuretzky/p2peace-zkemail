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
  dkimRegistry: "0xdfba380eb408444d1d418bf23994274f15cdd3c0",
  zkEmailVerifier: "0x63babfa2d223ee34403e88a6272842ee778ad2a3",
  mockGroth16Verifier: "0xf3ea51f794b2eb1a417f37ba5e69f87762e0d2ca",
  identityRegistry: "0xa9f9a182010776e41cbec5293f52f2c61bc47403",
  peaceTokenA: "0xd1454cccc2777af3042a4f557768cc80a427f468",
  peaceTokenB: "0x84e75d03db712847a80493d24b4a957bc4680986",
  treasury: "0x9bc24488e88089c5e178d7a5a7e47f609725fa1c",
  communityPoolA: "0x9a6645e7fa1cdb2c580173915581a9adcf5e2d5e",
  communityPoolB: "0xa676c72b9ad2acb68253757387b5bd2c326bef87",
  peaceMinterA: "0xeeaf1893229d69a003a8e1e6548fec383df87e39",
  peaceMinterB: "0x21172a8a553c65c6d68fe2c7241b444cb62dc5f5",
  incentiveRegistry: "0xa82e9f91265ff9bd86dc516d86b4fc082ee814bd",
  eventAttestation: "0xb65ad8b3f3cfd68e0cd4e46dca0669885bf1d367",
  redistributionEngine: "0x0ba7ac918f664ab4707ca8d0c69e8c4d06e59143",
  sanctionsEscrow: "0x07a1f0b3d83bf3517199ffa123bd56c48c0efbd4",
  realEmailVerifier: "0x6ac204183ebe2afe11097ae697ff1af0f5a3da44",
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

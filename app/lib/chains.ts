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
}

/**
 * Baked-in fallback addresses (Deploy.s.sol broadcast to Gnosis with DEMO_SETUP).
 * These are mutated in place by hydrateRemoteAddresses() when a newer manifest is
 * published, so a redeploy goes live without a frontend rebuild (crowdstake
 * convention). Treat this object as the single source module-level captures read.
 */
export const ADDRESSES: ContractAddresses = {
  reserveToken: "0xaf204776c7245bf4147c2612bf6e5972ee483701",
  dkimRegistry: "0x43f2e6b56ee3cf61c3e8e6b9f9cca71fb188cd66",
  zkEmailVerifier: "0xb4f9ffa1215b462a6661626d0dce1f47cba5fb19",
  mockGroth16Verifier: "0x32c2fe41a8f23611eb494748cdb086e7c4cef2ea",
  identityRegistry: "0x25568a8bbedbe159b28650a64e068dc7de40b77e",
  peaceTokenA: "0x665b7b61d0bb1f196d58355664e32b34f44553a5",
  peaceTokenB: "0x850a0e366727866bcffed4954b2bbfaa42ea85f1",
  treasury: "0x1a69d7149f2e0841d18b98213ca78f1cc41a8b90",
  communityPoolA: "0x950f15d5fd65534dc62b357787eecd7455146aef",
  communityPoolB: "0xfeb17043e4c8665eb903b17c9c3511d9f3274e71",
  peaceMinterA: "0xa8aa119634a7fe9f6b34f7911a8cdfe3ac4cd6ca",
  peaceMinterB: "0x07f951d3cfa9a8747e9e2d1a12f1f527ecb3b148",
  incentiveRegistry: "0xc1a08810bf50963023dd803dda0f84986324b2f3",
  eventAttestation: "0x81f24c3d6eaadb9d612395d0d399d863ba9c80b1",
  redistributionEngine: "0xcdc2737707b974f0a33af17ced55511348ac38e1",
  sanctionsEscrow: "0xfecb1f5b1a917493055f3e94c564ff8e58f6b12d",
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

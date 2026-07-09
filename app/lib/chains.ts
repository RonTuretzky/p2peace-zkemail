import { gnosis } from "wagmi/chains"

/**
 * The demo runs on Gnosis Chain (100): cheap, fast, and the same chain the
 * Breadchain / crowdstake deployments target.
 */
export const ACTIVE_CHAIN = gnosis
export const ACTIVE_CHAIN_ID = gnosis.id

/** The eight core contracts a page ever touches, keyed by role. */
export interface ContractAddresses {
  mockUsd: `0x${string}`
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
  disputeCouncil: `0x${string}`
  sanctionsEscrow: `0x${string}`
  businessRegistry: `0x${string}`
}

/**
 * Baked-in fallback addresses (Deploy.s.sol broadcast to Gnosis with DEMO_SETUP).
 * These are mutated in place by hydrateRemoteAddresses() when a newer manifest is
 * published, so a redeploy goes live without a frontend rebuild (crowdstake
 * convention). Treat this object as the single source module-level captures read.
 */
export const ADDRESSES: ContractAddresses = {
  mockUsd: "0x9af75a83661885db1848511b345f5f8a4badb4c0",
  dkimRegistry: "0x85cc25bb555f4bd82a9a36244094e88fd451b760",
  zkEmailVerifier: "0x9239f82a992238ab9a69af374161c5c2e8ffea2c",
  mockGroth16Verifier: "0x631a37682e18d34bfcc1416cf23e84df30bef326",
  identityRegistry: "0x60feeb1453f0b06de75e3a1b66f681f563d40b3d",
  peaceTokenA: "0x01b1a42aa56a623a437a7a55046784f43e8e27f0",
  peaceTokenB: "0x64ddd68c9656e660531bc1fc7ece156e066aa0d7",
  treasury: "0xf335fd10b0cadbfa7c0c6d41c7d8936621df8b81",
  communityPoolA: "0x6a1c3f73444030ca5884454d58a40ad4e01319dc",
  communityPoolB: "0x72a5f2a70fb10843dc3cb17057fe6a860ca55605",
  peaceMinterA: "0x7a76cfa8668a425b3f0e598c27019cd9d0e922f9",
  peaceMinterB: "0x7d21e680becdd1b9909d61ac5af0221bea13ddf2",
  incentiveRegistry: "0x559b6fa3673cbd822d411d4cb921f1db8528d8af",
  eventAttestation: "0x92ce3f819f2c2e588b7c3f3a609c0f70809f8640",
  redistributionEngine: "0xfdadb1d595e2bf55ac471f8a334ab73a2d191043",
  disputeCouncil: "0x907df415d4a0f25cfa7c787420e6a5dda3bb30b7",
  sanctionsEscrow: "0x76ae564ab2509bacd266c1a460795fb9a11757f7",
  businessRegistry: "0xcb8beb77bb449fbe717eead2511e1b045952b5f7",
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

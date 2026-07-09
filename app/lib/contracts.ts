import { keccak256, toBytes, encodeAbiParameters, pad, toHex } from "viem"
import { ADDRESSES, Community } from "./chains"

import mockUsdAbi from "./abis/MockUSD.json"
import identityAbi from "./abis/IdentityRegistry.json"
import peaceTokenAbi from "./abis/PeaceToken.json"
import minterAbi from "./abis/PeaceMinter.json"
import poolAbi from "./abis/CommunityPool.json"
import treasuryAbi from "./abis/Treasury.json"
import incentiveAbi from "./abis/IncentiveRegistry.json"
import attestationAbi from "./abis/EventAttestation.json"
import engineAbi from "./abis/RedistributionEngine.json"
import councilAbi from "./abis/DisputeCouncil.json"
import escrowAbi from "./abis/SanctionsEscrow.json"
import businessAbi from "./abis/BusinessRegistry.json"

export const abis = {
  mockUsd: mockUsdAbi,
  identity: identityAbi,
  peaceToken: peaceTokenAbi,
  minter: minterAbi,
  pool: poolAbi,
  treasury: treasuryAbi,
  incentive: incentiveAbi,
  attestation: attestationAbi,
  engine: engineAbi,
  council: councilAbi,
  escrow: escrowAbi,
  business: businessAbi,
} as const

/** wagmi `{ address, abi }` config for a role, read from the (hydratable) ADDRESSES. */
export const contract = {
  mockUsd: () => ({ address: ADDRESSES.mockUsd, abi: abis.mockUsd }),
  identity: () => ({ address: ADDRESSES.identityRegistry, abi: abis.identity }),
  incentive: () => ({ address: ADDRESSES.incentiveRegistry, abi: abis.incentive }),
  attestation: () => ({ address: ADDRESSES.eventAttestation, abi: abis.attestation }),
  engine: () => ({ address: ADDRESSES.redistributionEngine, abi: abis.engine }),
  council: () => ({ address: ADDRESSES.disputeCouncil, abi: abis.council }),
  escrow: () => ({ address: ADDRESSES.sanctionsEscrow, abi: abis.escrow }),
  business: () => ({ address: ADDRESSES.businessRegistry, abi: abis.business }),
  treasury: () => ({ address: ADDRESSES.treasury, abi: abis.treasury }),
  tokenA: () => ({ address: ADDRESSES.peaceTokenA, abi: abis.peaceToken }),
  tokenB: () => ({ address: ADDRESSES.peaceTokenB, abi: abis.peaceToken }),
  token: (c: Community) =>
    c === Community.A ? contract.tokenA() : contract.tokenB(),
  minterA: () => ({ address: ADDRESSES.peaceMinterA, abi: abis.minter }),
  minterB: () => ({ address: ADDRESSES.peaceMinterB, abi: abis.minter }),
  minter: (c: Community) => (c === Community.A ? contract.minterA() : contract.minterB()),
  poolA: () => ({ address: ADDRESSES.communityPoolA, abi: abis.pool }),
  poolB: () => ({ address: ADDRESSES.communityPoolB, abi: abis.pool }),
  pool: (c: Community) => (c === Community.A ? contract.poolA() : contract.poolB()),
} as const

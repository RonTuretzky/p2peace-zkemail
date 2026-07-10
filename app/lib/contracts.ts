import { keccak256, toBytes, encodeAbiParameters, pad, toHex } from "viem"
import { ADDRESSES, Community } from "./chains"

import erc20Abi from "./abis/MockUSD.json" // plain ERC20 surface — works for sDAI
import identityAbi from "./abis/IdentityRegistry.json"
import peaceTokenAbi from "./abis/PeaceToken.json"
import minterAbi from "./abis/PeaceMinter.json"
import poolAbi from "./abis/CommunityPool.json"
import treasuryAbi from "./abis/Treasury.json"
import incentiveAbi from "./abis/IncentiveRegistry.json"
import attestationAbi from "./abis/EventAttestation.json"
import engineAbi from "./abis/RedistributionEngine.json"
import escrowAbi from "./abis/SanctionsEscrow.json"
import realEmailAbi from "./abis/RealEmailVerifier.json"

export const abis = {
  reserve: erc20Abi,
  identity: identityAbi,
  peaceToken: peaceTokenAbi,
  minter: minterAbi,
  pool: poolAbi,
  treasury: treasuryAbi,
  incentive: incentiveAbi,
  attestation: attestationAbi,
  engine: engineAbi,
  escrow: escrowAbi,
  realEmail: realEmailAbi,
} as const

/** wagmi `{ address, abi }` config for a role, read from the (hydratable) ADDRESSES. */
export const contract = {
  reserve: () => ({ address: ADDRESSES.reserveToken, abi: abis.reserve }),
  identity: () => ({ address: ADDRESSES.identityRegistry, abi: abis.identity }),
  realEmail: () => ({ address: ADDRESSES.realEmailVerifier, abi: abis.realEmail }),
  incentive: () => ({ address: ADDRESSES.incentiveRegistry, abi: abis.incentive }),
  attestation: () => ({ address: ADDRESSES.eventAttestation, abi: abis.attestation }),
  engine: () => ({ address: ADDRESSES.redistributionEngine, abi: abis.engine }),
  escrow: () => ({ address: ADDRESSES.sanctionsEscrow, abi: abis.escrow }),
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

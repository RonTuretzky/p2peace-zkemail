import { formatUnits } from "viem"

/** Human token/USD amount (18 decimals) with up to 2 decimal places. */
export function fmt(v: bigint | undefined, decimals = 18, maxFrac = 2): string {
  if (v === undefined) return "—"
  const s = formatUnits(v, decimals)
  const n = Number(s)
  if (Number.isNaN(n)) return s
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac })
}

export function short(addr?: string): string {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ""
}

export const COMMUNITY_LABEL: Record<number, string> = {
  0: "Unverified",
  1: "Community A",
  2: "Community B",
}

export const DIRECTION_LABEL: Record<number, string> = {
  0: "Harmful action by A",
  1: "Harmful action by B",
  2: "Positive action — reward A",
  3: "Positive action — reward B",
  4: "Joint cooperation",
}

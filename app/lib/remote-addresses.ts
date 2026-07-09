import { getAddress, isAddress } from "viem"
import { ADDRESSES, ACTIVE_CHAIN_ID, type ContractAddresses } from "./chains"

/**
 * Runtime contract-address hydration (crowdstake convention).
 *
 * The contracts-deploy workflow publishes an addresses.json manifest to the
 * `addresses` branch on every deploy. Because this frontend is a static export
 * (GitHub Pages), fetching that manifest at runtime means new deployments go
 * live WITHOUT a frontend rebuild: the baked-in addresses in chains.ts become
 * mere fallbacks.
 *
 * CORS note: raw.githubusercontent.com sends `access-control-allow-origin: *`
 * (the GitHub release-asset download does not — it 302s to a host without CORS),
 * so we fetch the manifest from the raw `addresses` branch.
 *
 * Precedence: NEXT_PUBLIC_ADDRESSES_URL override → manifest → baked-in fallback.
 */
const MANIFEST_URL =
  "https://raw.githubusercontent.com/RonTuretzky/p2peace-zkemail/addresses/addresses.json"
const FETCH_TIMEOUT_MS = 5_000

interface Manifest {
  version: number
  chains: Record<string, { deployer?: string; contracts?: Partial<Record<keyof ContractAddresses, string>> }>
}

const KEYS = Object.keys(ADDRESSES) as (keyof ContractAddresses)[]

function checksum(v: string | undefined): `0x${string}` | null {
  return v && isAddress(v, { strict: false }) ? getAddress(v) : null
}

/**
 * Fetch the latest published addresses and merge them into ADDRESSES in place.
 * In-place mutation keeps module-level captures (e.g. contract configs built at
 * import time) live. Fail-soft: on any error the baked-in addresses stay.
 * @returns true if anything changed (callers re-render on that signal).
 */
export async function hydrateRemoteAddresses(): Promise<boolean> {
  const override = process.env.NEXT_PUBLIC_ADDRESSES_URL
  if (override === "off" || typeof window === "undefined") return false

  let manifest: Manifest
  try {
    const res = await fetch(override && override.length > 0 ? override : MANIFEST_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    manifest = (await res.json()) as Manifest
  } catch (e) {
    console.warn("[remote-addresses] using baked-in addresses:", e)
    return false
  }

  if (manifest?.version !== 1 || typeof manifest.chains !== "object") return false
  const entry = manifest.chains[String(ACTIVE_CHAIN_ID)]
  if (!entry?.contracts) return false

  let updated = false
  for (const k of KEYS) {
    const next = checksum(entry.contracts[k])
    if (next && ADDRESSES[k] !== next) {
      ADDRESSES[k] = next
      updated = true
    }
  }
  return updated
}

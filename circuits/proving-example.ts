/**
 * p2peace — end-to-end proving example
 * =====================================
 *
 * Walks the full pipeline from a raw email to an on-chain transaction, for both
 * proof types:
 *
 *   1. load a saved `.eml` file;
 *   2. generate a zkEmail Groth16 proof with the ZK Email SDK (`@zk-email/sdk`,
 *      blueprints hosted at https://registry.zk.email);
 *   3. reshape the SDK's output into the Solidity `EmailProof` tuple this repo's
 *      contracts consume;
 *   4. submit with viem: `IdentityRegistry.register` (citizenship) or
 *      `EventAttestation.attest` (news event).
 *
 * This file is a documented reference, not CI-run code (no package.json here).
 * To actually run it:  npm i @zk-email/sdk viem   (Node >= 18), fill in the
 * addresses/keys below, and `npx tsx proving-example.ts`.
 *
 * HONESTY NOTES (see circuits/README.md §3):
 *  - `@zk-email/sdk` is real, public tooling; blueprint slugs, `getBlueprint`,
 *    `createProver`, `generateProof`, and external inputs all exist today. Exact
 *    accessor names for proof internals have shifted across SDK versions — the
 *    reshaping helpers below say what they need ({pi_a, pi_b, pi_c} + public
 *    signals, i.e. standard snarkjs output) so they are easy to re-pin.
 *  - The six-signal logical ABI (…, extraData) and the adapter that produces it
 *    from raw circuit signals are p2peace-specific; `formatEmailProof` below
 *    consumes the *logical* signals as served for our compiled blueprints.
 */

import { readFile } from "node:fs/promises";
import zkeSdk from "@zk-email/sdk"; // default export: SDK factory
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// ---------------------------------------------------------------------------
// 0. Configuration
// ---------------------------------------------------------------------------

const RPC_URL = process.env.RPC_URL ?? "https://rpc.sepolia.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex; // submitter (may be a relayer!)

// Deployed contract addresses (see contracts/script/Deploy.s.sol output).
const IDENTITY_REGISTRY = "0x0000000000000000000000000000000000000001" as const;
const EVENT_ATTESTATION = "0x0000000000000000000000000000000000000002" as const;

// Blueprint pins. patternHash = keccak256(utf8(slug + "@" + version)) — README §5.
const CITIZENSHIP_SLUG = "p2peace/citizenship-v1@1";
const NEWS_EVENT_SLUG = "p2peace/news-event-v1/incentive-42@1";

// Minimal ABI fragments for the two entry points. The EmailProof tuple mirrors
// contracts/src/interfaces/IZKEmailVerifier.sol exactly.
const abi = parseAbi([
  "struct EmailProof { bytes32 dkimPubkeyHash; bytes32 domainHash; bytes32 nullifier; bytes32 patternHash; uint64 emailTimestamp; uint256[8] proof; }",
  "function register(EmailProof proof, uint8 communityId, address wallet) external",
  "function attest(uint256 incentiveId, EmailProof proof) external",
]);

// ---------------------------------------------------------------------------
// 1. Reshaping helpers: snarkjs/SDK output  →  Solidity EmailProof tuple
// ---------------------------------------------------------------------------

/** snarkjs-style Groth16 proof points (decimal strings). */
interface SnarkjsProof {
  pi_a: string[]; // [x, y, 1]
  pi_b: string[][]; // [[x0, x1], [y0, y1], [1, 0]] — snarkjs order, real part first
  pi_c: string[]; // [x, y, 1]
}

/**
 * Flatten Groth16 points into the uint256[8] layout the verifier expects:
 * [aX, aY, bX1, bX0, bY1, bY0, cX, cY].
 *
 * THE CLASSIC FOOTGUN: snarkjs's proof.json stores each G2 (pi_b) coordinate
 * pair as [c0, c1] (real part first), but the EVM pairing precompile — and
 * therefore every snarkjs-exported Solidity verifier — expects the imaginary
 * part first: [c1, c0]. `snarkjs generatecall` performs this swap for you;
 * when packing proof.json manually (as here) you must swap each pi_b pair
 * yourself. If a proof that verifies fine off-chain reverts on-chain, check
 * this first.
 */
function packGroth16(p: SnarkjsProof): readonly bigint[] {
  return [
    BigInt(p.pi_a[0]), BigInt(p.pi_a[1]),
    BigInt(p.pi_b[0][1]), BigInt(p.pi_b[0][0]), // swapped: imaginary first
    BigInt(p.pi_b[1][1]), BigInt(p.pi_b[1][0]), // swapped: imaginary first
    BigInt(p.pi_c[0]), BigInt(p.pi_c[1]),
  ] as const;
}

/** Logical public signals, README §2 order. */
interface LogicalSignals {
  dkimPubkeyHash: bigint; // [0]
  domainHash: bigint;     // [1] (adapter-computed keccak; served with proof metadata)
  nullifier: bigint;      // [2]
  patternHash: bigint;    // [3]
  emailTimestamp: bigint; // [4]
  extraData: bigint;      // [5] wallet (citizenship) | 0 (news event)
}

function toBytes32(x: bigint): Hex {
  return `0x${x.toString(16).padStart(64, "0")}` as Hex;
}

/** Build the Solidity EmailProof tuple (extraData travels as a call argument,
 *  not in the struct — ZKEmailVerifier.verify(proof, extraData)). */
function formatEmailProof(sig: LogicalSignals, proof: SnarkjsProof) {
  return {
    dkimPubkeyHash: toBytes32(sig.dkimPubkeyHash),
    domainHash: toBytes32(sig.domainHash),
    nullifier: toBytes32(sig.nullifier),
    patternHash: toBytes32(sig.patternHash),
    emailTimestamp: sig.emailTimestamp, // uint64
    proof: packGroth16(proof) as unknown as readonly [
      bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
    ],
  };
}

// ---------------------------------------------------------------------------
// 2. Citizenship: .eml → proof → IdentityRegistry.register
// ---------------------------------------------------------------------------

async function proveAndRegisterCitizenship(
  emlPath: string,
  communityId: number, // 0 = A, 1 = B
  wallet: Hex,         // wallet being enrolled (≠ tx sender if relayed)
) {
  // (a) Raw email. Must be the *original* received message with intact
  //     DKIM-Signature header — "Show original / Download message" in the mail
  //     client. Forwarded copies will NOT verify (docs/ZKEMAIL-DESIGN.md §7).
  const eml = await readFile(emlPath, "utf-8");

  // (b) SDK + blueprint. The blueprint (circuits/blueprints/citizenship.json,
  //     compiled instance for the user's government domain) is fetched from the
  //     registry along with its proving artifacts (.wasm witness gen + .zkey —
  //     large, ~1 GB class; cache aggressively in a real app).
  const sdk = zkeSdk();
  const blueprint = await sdk.getBlueprint(CITIZENSHIP_SLUG);

  // (c) LOCAL proving is mandatory for citizenship: the .eml identifies the
  //     citizen, and remote proving ships the raw email to the prover service.
  //     Expect ~30–90 s in-browser / Node WASM (README §7).
  const prover = blueprint.createProver({ isLocal: true });

  // (d) External input binds the proof to the target wallet. Inside the
  //     circuit this becomes public signal 5 (extraData); IdentityRegistry
  //     requires extraData == uint256(uint160(wallet)), so a relayer that
  //     swaps the wallet argument just makes verification fail.
  const proofObj = await prover.generateProof(eml, [
    { name: "walletAddress", value: wallet, maxLength: 44 },
  ]);

  // (e) Unpack. `getProofData()` returns the snarkjs proof points and the
  //     public signals for our blueprint's logical ABI (see HONESTY NOTES —
  //     re-pin these two lines against your installed SDK version).
  const { proofData, publicSignals } = extractSdkOutputs(proofObj);
  const signals = mapLogicalSignals(publicSignals);

  // Sanity: the wallet binding must round-trip before we spend gas.
  if (signals.extraData !== BigInt(wallet)) {
    throw new Error("extraData does not match target wallet — wrong external input?");
  }

  // (f) Submit. Anyone may send this tx (gasless relaying is safe: the proof
  //     is bound to `wallet` and replay-blocked by the nullifier).
  const account = privateKeyToAccount(PRIVATE_KEY);
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });
  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });

  const hash = await walletClient.writeContract({
    address: IDENTITY_REGISTRY,
    abi,
    functionName: "register",
    args: [formatEmailProof(signals, proofData), communityId, wallet],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`registered: community=${communityId} wallet=${wallet} tx=${receipt.transactionHash}`);
}

// ---------------------------------------------------------------------------
// 3. News event: .eml → proof → EventAttestation.attest
// ---------------------------------------------------------------------------

async function proveAndAttestNewsEvent(emlPath: string, incentiveId: bigint) {
  const eml = await readFile(emlPath, "utf-8");

  const sdk = zkeSdk();
  // One blueprint instance per incentive: its body regexes are the compiled
  // keyword logic (keyword-compiler.md) whose patternHash the incentive stores.
  const blueprint = await sdk.getBlueprint(NEWS_EVENT_SLUG);

  // Newsletters are public content, so the hosted remote prover is acceptable
  // here (and much faster on phones). Attesters who prefer not to reveal their
  // subscriptions can still pass { isLocal: true }.
  const prover = blueprint.createProver();

  // No external inputs: extraData is fixed to 0 for attestations.
  const proofObj = await prover.generateProof(eml, []);

  const { proofData, publicSignals } = extractSdkOutputs(proofObj);
  const signals = mapLogicalSignals(publicSignals);

  if (signals.extraData !== 0n) throw new Error("attestation proof must carry extraData = 0");

  const account = privateKeyToAccount(PRIVATE_KEY);
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });

  // EventAttestation checks, in order: patternHash == incentive.patternHash;
  // domainHash ∈ incentive source set (and tags its category A/B/Intl);
  // emailTimestamp inside the attestation window; nullifier (Poseidon of the
  // DKIM signature — unique per physical email) unused; then tallies the
  // distinct-source thresholds (≥1 A, ≥1 B, ≥2 Intl by default).
  const hash = await walletClient.writeContract({
    address: EVENT_ATTESTATION,
    abi,
    functionName: "attest",
    args: [incentiveId, formatEmailProof(signals, proofData)],
  });
  console.log(`attested incentive #${incentiveId} tx=${hash}`);
}

// ---------------------------------------------------------------------------
// 4. SDK-output plumbing (version-sensitive; see HONESTY NOTES)
// ---------------------------------------------------------------------------

/**
 * Pull (snarkjs proof, public signals) out of the SDK's Proof object.
 * Recent SDK versions expose `proof.getProofData()`; older ones exposed
 * `proof.props.proofData` / `proof.props.publicOutputs`. Normalize here so the
 * rest of the file never touches SDK internals.
 */
function extractSdkOutputs(proofObj: any): {
  proofData: SnarkjsProof;
  publicSignals: string[];
} {
  const d = typeof proofObj.getProofData === "function"
    ? proofObj.getProofData()
    : proofObj.props;
  return {
    proofData: (d.proofData ?? d.proof) as SnarkjsProof,
    publicSignals: (d.publicData ?? d.publicOutputs ?? d.publicSignals) as string[],
  };
}

/** Map the served logical signal array (README §2 order) onto named fields. */
function mapLogicalSignals(sig: string[]): LogicalSignals {
  if (sig.length < 6) throw new Error(`expected 6 logical signals, got ${sig.length}`);
  return {
    dkimPubkeyHash: BigInt(sig[0]),
    domainHash: BigInt(sig[1]),
    nullifier: BigInt(sig[2]),
    patternHash: BigInt(sig[3]),
    emailTimestamp: BigInt(sig[4]),
    extraData: BigInt(sig[5]),
  };
}

// ---------------------------------------------------------------------------
// 5. Entry point
// ---------------------------------------------------------------------------

async function main() {
  const [mode, emlPath, arg] = process.argv.slice(2);
  if (mode === "citizenship") {
    // usage: tsx proving-example.ts citizenship tax-receipt.eml 0xYourWallet
    await proveAndRegisterCitizenship(emlPath, 0, arg as Hex);
  } else if (mode === "news") {
    // usage: tsx proving-example.ts news reuters-alert.eml 42
    await proveAndAttestNewsEvent(emlPath, BigInt(arg));
  } else {
    console.log("usage: proving-example.ts <citizenship|news> <file.eml> <wallet|incentiveId>");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

// Generates a REAL Groth16 withdrawal proof + the on-chain fixtures the Foundry/Sepolia
// tests consume. Builds a Poseidon Merkle tree in JS that mirrors the Solidity tree
// exactly (same zero value, same insert), proves membership of a fresh commitment, and
// self-verifies. Also emits the circomlib Poseidon(2) EVM bytecode for the on-chain
// hasher, so the Solidity tree hashes identically to the circuit.

import { buildPoseidon, poseidonContract } from "circomlibjs";
import * as snarkjs from "snarkjs";
import pkg from "js-sha3";
const { keccak256 } = pkg;
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = dirname(fileURLToPath(import.meta.url));
const LEVELS = 20;
// Fixed zero leaf, shared byte-for-byte with the Solidity tree (< BN254 field).
const ZERO = 21663839004416932945382355908790599225266501822907911457504978515578255421292n;

const poseidon = await buildPoseidon();
const F = poseidon.F;
const H2 = (a, b) => F.toObject(poseidon([a, b]));
const H1 = (a) => F.toObject(poseidon([a]));

// Precompute zero-subtree roots: zeros[0]=ZERO, zeros[i+1]=H2(zeros[i],zeros[i]).
const zeros = [ZERO];
for (let i = 1; i < LEVELS; i++) zeros.push(H2(zeros[i - 1], zeros[i - 1]));

// A fresh note.
const nullifier = 111111111111111111111111111111111111111111n;
const secret = 222222222222222222222222222222222222222222n;
const commitment = H2(nullifier, secret);
const nullifierHash = H1(nullifier);

// Insert at leaf index 0 of an empty tree: every sibling is the zero-subtree of its level,
// every pathIndex is 0 (current node is always the left child).
const pathElements = zeros.slice(0, LEVELS);
const pathIndices = new Array(LEVELS).fill(0);
let root = commitment;
for (let i = 0; i < LEVELS; i++) root = H2(root, zeros[i]);

// extData binding: MUST equal the pool's uint256(keccak256(abi.encode(ExtData))) % FIELD.
// ExtData{address relayer; uint256 fee} encodes as pad32(relayer) ++ pad32(fee).
const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const RELAYER = "0x000000000000000000000000000000000000c0de";
const FEE = 0n;
const encoded = Buffer.from(
  RELAYER.slice(2).padStart(64, "0") + FEE.toString(16).padStart(64, "0"),
  "hex"
);
const extDataHash = BigInt("0x" + keccak256(encoded)) % FIELD;

const input = {
  root: root.toString(),
  nullifierHash: nullifierHash.toString(),
  extDataHash: extDataHash.toString(),
  nullifier: nullifier.toString(),
  secret: secret.toString(),
  pathElements: pathElements.map((x) => x.toString()),
  pathIndices: pathIndices.map((x) => x.toString()),
};

const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  input, join(DIR, "build/withdraw_js/withdraw.wasm"), join(DIR, "build/withdraw_final.zkey")
);

const vkey = JSON.parse((await import("node:fs")).readFileSync(join(DIR, "build/verification_key.json")));
const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
console.log("self-verify:", ok);
console.log("publicSignals:", publicSignals);

// Solidity calldata (a, b, c, pubSignals) — the exact ordering the verifier expects.
const cd = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
const [pA, pB, pC, pub] = JSON.parse("[" + cd + "]");

// Pack into the pool's IGroth16Verifier proof[8] = [a0,a1, b00,b01,b10,b11, c0,c1].
const proof8 = [pA[0], pA[1], pB[0][0], pB[0][1], pB[1][0], pB[1][1], pC[0], pC[1]];

writeFileSync(join(DIR, "build/fixture.json"), JSON.stringify({
  zero: ZERO.toString(),
  commitment: commitment.toString(),
  root: root.toString(),
  nullifierHash: nullifierHash.toString(),
  extDataHash: extDataHash.toString(),
  proof8, pA, pB, pC, pubSignals: pub,
}, null, 2));

// Poseidon(2) EVM bytecode + ABI for the on-chain hasher.
writeFileSync(join(DIR, "build/poseidon2_bytecode.txt"), poseidonContract.createCode(2));
console.log("zeros[0..2]:", zeros.slice(0, 3).map(String));
console.log("commitment:", commitment.toString());
console.log("root:", root.toString());
console.log("wrote build/fixture.json + build/poseidon2_bytecode.txt");
process.exit(0);

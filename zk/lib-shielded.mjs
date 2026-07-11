// Client-side shielded-pool toolkit: generate a note, reconstruct the Poseidon Merkle
// tree, and produce a REAL withdraw proof — all off-chain. The same logic runs in a
// browser with snarkjs (wasm + the 4.9 MB withdraw zkey). No secrets ever leave here.

import { buildPoseidon } from "circomlibjs";
import * as snarkjs from "snarkjs";
import pkg from "js-sha3";
const { keccak256 } = pkg;
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
export const LEVELS = 20;
export const FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const ZERO =
  21663839004416932945382355908790599225266501822907911457504978515578255421292n;

let _poseidon;
async function P() {
  if (!_poseidon) _poseidon = await buildPoseidon();
  return _poseidon;
}
export async function H2(a, b) {
  const p = await P();
  return p.F.toObject(p([a, b]));
}
export async function H1(a) {
  const p = await P();
  return p.F.toObject(p([a]));
}
const rndField = () => BigInt("0x" + randomBytes(31).toString("hex")) % FIELD;

/// A fresh note: the deposit's commitment hides these; the withdrawal reveals only nullifierHash.
export async function genNote() {
  const nullifier = rndField();
  const secret = rndField();
  return {
    nullifier,
    secret,
    commitment: await H2(nullifier, secret),
    nullifierHash: await H1(nullifier),
  };
}

/// Poseidon Merkle tree that mirrors the on-chain pool exactly (same ZERO, same insert).
export class MerkleTree {
  constructor(levels = LEVELS) {
    this.levels = levels;
    this.leaves = [];
    this.zeros = [ZERO];
  }
  async init() {
    for (let i = 1; i < this.levels; i++) this.zeros.push(await H2(this.zeros[i - 1], this.zeros[i - 1]));
    return this;
  }
  add(leaf) {
    this.leaves.push(BigInt(leaf));
    return this.leaves.length - 1;
  }
  async _up(cur, level) {
    const next = [];
    for (let i = 0; i < cur.length; i += 2) {
      const left = cur[i];
      const right = i + 1 < cur.length ? cur[i + 1] : this.zeros[level];
      next.push(await H2(left, right));
    }
    return next;
  }
  async root() {
    let cur = this.leaves.slice();
    for (let l = 0; l < this.levels; l++) cur = cur.length ? await this._up(cur, l) : [this.zeros[l + 1] ?? ZERO];
    return cur[0];
  }
  async path(index) {
    const pathElements = [];
    const pathIndices = [];
    let idx = index;
    let cur = this.leaves.slice();
    for (let l = 0; l < this.levels; l++) {
      const isRight = idx % 2;
      const sibIdx = isRight ? idx - 1 : idx + 1;
      const sib = sibIdx < cur.length ? cur[sibIdx] : this.zeros[l];
      pathElements.push(sib.toString());
      pathIndices.push(isRight);
      cur = await this._up(cur, l);
      idx = idx >> 1;
    }
    return { pathElements, pathIndices };
  }
}

/// keccak256(abi.encode(ExtData{address relayer; uint256 fee})) % FIELD — must match the pool.
export function extDataHash(relayer, fee) {
  const enc = Buffer.from(
    relayer.replace(/^0x/, "").padStart(64, "0") + BigInt(fee).toString(16).padStart(64, "0"),
    "hex"
  );
  return BigInt("0x" + keccak256(enc)) % FIELD;
}

/// Produce a REAL Groth16 withdraw proof for `note` at `index` in `tree`, bound to (relayer, fee).
export async function proveWithdraw(note, tree, index, relayer, fee) {
  const root = await tree.root();
  const { pathElements, pathIndices } = await tree.path(index);
  const edh = extDataHash(relayer, fee);
  const input = {
    root: root.toString(),
    nullifierHash: note.nullifierHash.toString(),
    extDataHash: edh.toString(),
    nullifier: note.nullifier.toString(),
    secret: note.secret.toString(),
    pathElements,
    pathIndices: pathIndices.map(String),
  };
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input, join(DIR, "build/withdraw_js/withdraw.wasm"), join(DIR, "build/withdraw_final.zkey")
  );
  const cd = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const [pA, pB, pC] = JSON.parse("[" + cd + "]");
  const proof8 = [pA[0], pA[1], pB[0][0], pB[0][1], pB[1][0], pB[1][1], pC[0], pC[1]];
  return {
    proof8,
    root: root.toString(),
    nullifierHash: note.nullifierHash.toString(),
    ext: { relayer, fee: fee.toString() },
  };
}

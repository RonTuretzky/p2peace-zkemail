// Generates a REAL zkEmail provenance proof from the genuine Bit2C withdrawal email.
// The email/header/signature stay PRIVATE (witness only, never written out); only the
// proof + public signals are emitted, and they reveal nothing about the email content.
// Public signals (circuit order): [pubkeyHash, nullifier, domainHash, patternHash,
// emailTimestamp, extraData].

import * as snarkjs from "snarkjs";
import pkg from "js-sha3";
const { keccak256 } = pkg;
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const kh = (s) => (BigInt("0x" + keccak256(s)) % FIELD).toString();

const base = JSON.parse(readFileSync(join(DIR, "build/prov-input-base.json")));
const input = {
  emailHeader: base.emailHeader,
  emailHeaderLength: base.emailHeaderLength,
  pubkey: base.pubkey,
  signature: base.signature,
  domainHash: kh("bit2c.co.il"),
  patternHash: kh("p2peace/exit-receipt-v1"),
  emailTimestamp: "1700000000",
  extraData: "0",
};

const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  input, join(DIR, "build/provenance_js/provenance.wasm"), join(DIR, "build/provenance_final.zkey")
);
const vkey = JSON.parse(readFileSync(join(DIR, "build/provenance_vkey.json")));
console.log("self-verify:", await snarkjs.groth16.verify(vkey, publicSignals, proof));
console.log("publicSignals [pubkeyHash, nullifier, domainHash, patternHash, ts, extraData]:");
console.log(publicSignals);

const cd = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
const [pA, pB, pC] = JSON.parse("[" + cd + "]");
const proof8 = [pA[0], pA[1], pB[0][0], pB[0][1], pB[1][0], pB[1][1], pC[0], pC[1]];
const hx = (x) => "0x" + BigInt(x).toString(16);

writeFileSync(join(DIR, "../contracts/test/provenance-fixture.json"), JSON.stringify({
  pubkeyHash: hx(publicSignals[0]),
  nullifier: hx(publicSignals[1]),
  domainHash: hx(publicSignals[2]),
  patternHash: hx(publicSignals[3]),
  emailTimestamp: publicSignals[4],
  extraData: hx(publicSignals[5]),
  proof8: proof8.map(hx),
}, null, 2));
console.log("wrote contracts/test/provenance-fixture.json");
process.exit(0);

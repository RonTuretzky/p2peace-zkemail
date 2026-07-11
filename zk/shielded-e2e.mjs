// Full FRESH shielded exit on Sepolia using client-side note + withdraw-proof generation:
//   genNote → mintVoucher (real zkEmail proof) → deposit → CLIENT proveWithdraw → relay.
// Nothing about the note or the depositor is revealed on the withdrawal side.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { genNote, MerkleTree, proveWithdraw } from "./lib-shielded.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const RPC = process.env.RPC || "https://ethereum-sepolia-rpc.publicnode.com";
const PK = process.env.PK;
const ME = process.env.ME;
const POOL = process.env.POOL;
const USD = process.env.USD;
const EA = process.env.EA;
const DENOM = "1000000000000000000000";

const send = (args) =>
  execFileSync("cast", ["send", ...args, "--rpc-url", RPC, "--private-key", PK], { stdio: ["ignore", "ignore", "ignore"] });
const call = (args) => execFileSync("cast", ["call", ...args, "--rpc-url", RPC], { encoding: "utf8" }).trim();

const prov = JSON.parse(readFileSync(join(DIR, "../contracts/test/provenance-fixture.json")));

console.log("1. client generates a fresh note (nullifier+secret stay local)");
const note = await genNote();
console.log("   commitment:", note.commitment.toString().slice(0, 20) + "...");

console.log("2. mint MockUSD + mintVoucher with the REAL zkEmail proof");
send([USD, "mint(address,uint256)", ME, DENOM]);
send([
  POOL, "mintVoucher((bytes32,bytes32,bytes32,bytes32,uint64,uint256[8]))",
  `(${prov.pubkeyHash},${prov.domainHash},${prov.nullifier},${prov.patternHash},1700000000,[${prov.proof8.join(",")}])`,
]);
console.log("   voucher:", call([POOL, "voucher(bytes32)(bool)", prov.nullifier]));

console.log("3. deposit the note's commitment");
send([USD, "approve(address,uint256)", POOL, DENOM]);
send([POOL, "deposit(bytes32,uint256)", prov.nullifier, note.commitment.toString()]);

console.log("4. CLIENT-SIDE: rebuild the tree + generate the withdraw proof");
const tree = await new MerkleTree().init();
const idx = tree.add(note.commitment);
const job = await proveWithdraw(note, tree, idx, ME, 0n); // relayer=ME, fee=0
const onchainRoot = call([POOL, "getLastRoot()(uint256)"]).split(" ")[0];
console.log("   client root == on-chain root?", job.root === onchainRoot ? "YES" : "NO");

console.log("5. RELAYER submits the withdrawal (proof bound to relayer+fee)");
send([
  POOL, "withdraw(uint256[8],uint256,uint256,(address,uint256))",
  `[${job.proof8.join(",")}]`, job.root, job.nullifierHash, `(${job.ext.relayer},${job.ext.fee})`,
]);

console.log("=== RESULT ===");
console.log("exitIndex:", call([EA, "exitIndex()(uint256)"]).split(" ")[0]);
console.log("nullifier spent:", call([POOL, "nullifierSpent(uint256)(bool)", job.nullifierHash]));
process.exit(0);

// A real relayer service for the shielded pool. It accepts a withdrawal job (a proof
// bound to its own relayer address + fee), submits pool.withdraw() paying gas, and takes
// the fee from the note — so the withdrawing party never needs an ETH-funded wallet and
// no funding edge links them to the deposit. Production would run this permissionlessly
// (a relayer market / 4337 paymaster) over Tor/Waku; this is the single-relayer core.
//
// Run:  RELAYER_PK=0x... RPC=https://... POOL=0x... node relayer.mjs   (listens on :8790)
// Job:  POST /relay  { proof8:[8], root, nullifierHash, ext:{relayer,fee} }

import http from "node:http";
import { execFileSync } from "node:child_process";

const RPC = process.env.RPC || "https://ethereum-sepolia-rpc.publicnode.com";
const POOL = process.env.POOL;
const PK = process.env.RELAYER_PK;
const PORT = Number(process.env.PORT || 8790);
if (!POOL || !PK) {
  console.error("set POOL and RELAYER_PK");
  process.exit(1);
}

function submitWithdraw(job) {
  const proof = "[" + job.proof8.join(",") + "]";
  const ext = `(${job.ext.relayer},${job.ext.fee})`;
  const out = execFileSync(
    "cast",
    [
      "send", POOL,
      "withdraw(uint256[8],uint256,uint256,(address,uint256))",
      proof, String(job.root), String(job.nullifierHash), ext,
      "--rpc-url", RPC, "--private-key", PK, "--json",
    ],
    { encoding: "utf8" }
  );
  return JSON.parse(out).transactionHash;
}

http
  .createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/relay") {
      res.writeHead(404).end("POST /relay");
      return;
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const tx = submitWithdraw(JSON.parse(body));
        console.log("relayed:", tx);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ tx }));
      } catch (e) {
        console.error("relay failed:", e.message);
        res.writeHead(500, { "content-type": "application/json" }).end(
          JSON.stringify({ error: String(e.message).slice(0, 300) })
        );
      }
    });
  })
  .listen(PORT, () => console.log(`relayer on :${PORT} → pool ${POOL}`));

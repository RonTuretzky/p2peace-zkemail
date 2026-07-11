// Generates a SYNTHETIC, PII-free DKIM conversion-receipt vector for
// ExitReceiptVerifier tests. Self-signs with a throwaway RSA key (the private key is
// discarded — only the public modulus, the canonical signed headers, the signature,
// and the raw body are kept). Run: node script/gen-exit-vector.mjs
//
// The email models what a conforming ILS ramp WOULD emit: a receipt whose DKIM-signed
// body carries the destination on-chain address (full, un-truncated) and the ILS
// amount, so the on-chain verifier can bind the address and read the amount. No real
// exchange emits exactly this today (see docs/CURRENCY-MECHANISM.md) — the vector
// proves the machine, not a specific sender.

import { generateKeyPairSync, createHash, sign as rsaSign } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "exit-receipt-vector.json");

// --- fixed field values the tests assert against
const FROM = "noreply@ramp.example";
const DOMAIN = "ramp.example";
const SELECTOR = "exitsel";
const DEST_ADDRESS = "0x1111111111111111111111111111111111111111"; // the bound wallet
const ILS = 10000;

// Raw body, WITH extra trailing blank lines so simple-canonicalization stripping is
// exercised on-chain. Lines end with CRLF (as a real MIME body would).
const bodyLines = [
  "National Exit Ramp",
  "",
  `You converted ILS ${ILS} into USDC and withdrew it on-chain.`,
  "",
  `p2peace-exit-ils=${ILS}`,
  `p2peace-exit-address=${DEST_ADDRESS}`,
  "",
  "Keep this email as your receipt.",
  "",
  "",
  "",
];
const bodyRaw = Buffer.from(bodyLines.join("\r\n"), "utf8");

// DKIM "simple" body canonicalization: strip trailing CRLF-only lines to a single CRLF.
function simpleCanon(body) {
  let end = body.length;
  while (end >= 2 && body[end - 2] === 0x0d && body[end - 1] === 0x0a) end -= 2;
  return Buffer.concat([body.subarray(0, end), Buffer.from("\r\n")]);
}

const bh = createHash("sha256").update(simpleCanon(bodyRaw)).digest().toString("base64");

// Canonical signed-header block (relaxed header style: lowercase names, single spaces).
// The dkim-signature line carries bh= and an emptied b= — this is exactly what a
// verifier signs/checks. We construct it directly since we control the vector.
const signedData = Buffer.from(
  [
    `from:National Exit Ramp <${FROM}>`,
    "to:citizen@example.com",
    "subject:Your conversion is complete",
    "date:Wed, 08 Jul 2026 10:00:00 +0000",
    `dkim-signature:v=1; a=rsa-sha256; c=relaxed/simple; d=${DOMAIN}; s=${SELECTOR}; h=from:to:subject:date; bh=${bh}; b=`,
  ].join("\r\n"),
  "utf8",
);

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
// EMSA-PKCS1-v1.5 over SHA-256 (Node default padding for RSA sign) — matches RSAPKCS1.sol.
const signature = rsaSign("sha256", signedData, privateKey);

const jwk = publicKey.export({ format: "jwk" });
const modulus = Buffer.from(jwk.n, "base64url"); // big-endian RSA n
const exponent = Buffer.from(jwk.e, "base64url"); // 0x010001

const hex = (b) => b.toString("hex");
writeFileSync(
  OUT,
  JSON.stringify(
    {
      _comment:
        "SYNTHETIC exit-receipt vector (self-signed throwaway key, no PII). Proves the on-chain DKIM body-hash + address-binding path. See docs/CURRENCY-MECHANISM.md.",
      signedData: hex(signedData),
      signature: hex(signature),
      modulus: hex(modulus),
      exponent: hex(exponent),
      body: hex(bodyRaw),
      from: FROM,
      domain: DOMAIN,
      selector: SELECTOR,
      destAddress: DEST_ADDRESS,
      ils: ILS,
    },
    null,
    0,
  ) + "\n",
);

console.log("wrote", OUT);
console.log("  bh =", bh);
console.log("  modulus bytes =", modulus.length, " signature bytes =", signature.length);

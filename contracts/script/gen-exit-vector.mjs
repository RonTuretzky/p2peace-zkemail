// Generates a SYNTHETIC, PII-free DKIM conversion-receipt vector for
// ExitReceiptVerifier tests, modeled on the REAL Bit2C withdrawal-confirmation
// format: c=relaxed/relaxed, a quoted-printable HTML body carrying the full
// destination address split by a QP soft break (as Bit2C's really is, e.g.
// `...Cf24=\r\n21676946C`). Self-signs with a throwaway RSA key (private key
// discarded). Run: node script/gen-exit-vector.mjs
//
// No real exchange key is used here — this proves the on-chain machine (relaxed
// body hash + QP-tolerant address extraction + RSA). The live deployment registers
// Bit2C's actual s1 key so genuine Bit2C emails verify (see DeployExit).

import { generateKeyPairSync, createHash, sign as rsaSign } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "exit-receipt-vector.json");

const FROM = "info@bit2c-demo.example"; // synthetic sender (no PII)
const DOMAIN = "bit2c-demo.example";
const SELECTOR = "s1";
const DEST = "0x1111111111111111111111111111111111111111"; // the bound wallet

// Raw quoted-printable HTML body. The address is split by a QP soft break (=\r\n)
// mid-hex, exactly like the real Bit2C receipt, to exercise the on-chain extractor.
const addrHex = DEST.slice(2); // 40 hex
const addrSplit = "0x" + addrHex.slice(0, 24) + "=\r\n" + addrHex.slice(24); // soft break at 24
const bodyRaw = Buffer.from(
  [
    "<html><body>",
    "<p>Bit2C withdrawal confirmation.</p>",
    "<p>You withdrew crypto to an address you own.</p>",
    `<p dir=3D"ltr">${addrSplit}</p>`,
    "<p>Keep this email as your receipt.</p>",
    "</body></html>",
    "",
    "",
  ].join("\r\n"),
  "latin1",
);

// DKIM "relaxed" body canonicalization (RFC 6376 §3.4.4) — must match the contract.
function relaxedBody(buf) {
  let s = buf.toString("latin1");
  s = s.replace(/[\t ]+\r\n/g, "\r\n"); // (a) strip trailing WSP before CRLF
  s = s.replace(/[\t ]+/g, " "); // (b) collapse WSP runs to single SP
  s = s.replace(/(\r\n)+$/, "\r\n"); // (c) collapse trailing empty lines
  if (!s.endsWith("\r\n")) s += "\r\n";
  return Buffer.from(s, "latin1");
}

const bh = createHash("sha256").update(relaxedBody(bodyRaw)).digest().toString("base64");

const signedData = Buffer.from(
  [
    `from:Bit2C <${FROM}>`,
    "to:citizen@example.com",
    "subject:Your withdrawal is complete",
    "date:Wed, 08 Jul 2026 10:00:00 +0000",
    `dkim-signature:v=1; a=rsa-sha256; c=relaxed/relaxed; d=${DOMAIN}; s=${SELECTOR}; h=from:to:subject:date; bh=${bh}; b=`,
  ].join("\r\n"),
  "utf8",
);

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const signature = rsaSign("sha256", signedData, privateKey); // EMSA-PKCS1-v1.5 / SHA-256
const jwk = publicKey.export({ format: "jwk" });

const hex = (b) => b.toString("hex");
writeFileSync(
  OUT,
  JSON.stringify(
    {
      _comment:
        "SYNTHETIC exit-receipt vector (self-signed throwaway key, no PII), modeled on the real Bit2C withdrawal format: relaxed/relaxed, QP body with a soft-break-split address. See docs/CURRENCY-MECHANISM.md.",
      signedData: hex(signedData),
      signature: hex(signature),
      modulus: hex(Buffer.from(jwk.n, "base64url")),
      exponent: hex(Buffer.from(jwk.e, "base64url")),
      body: hex(bodyRaw),
      from: FROM,
      domain: DOMAIN,
      selector: SELECTOR,
      destAddress: DEST,
    },
    null,
    0,
  ) + "\n",
);
console.log("wrote", OUT, "\n  bh =", bh, "\n  body bytes =", bodyRaw.length);

// Plain node script (run with: npx tsx lib/dkim.test.mjs).
// Reads the test .eml + known-good vector, runs parseEml, and asserts the
// canonicalized signed headers + signature match byte-for-byte.
//
// Skips gracefully if the fixtures are absent (they are deleted before ship).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseEml } from "./dkim.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const emlPath = join(__dirname, "__test_email.eml");
const vecPath = join(__dirname, "__test_vector.json");

if (!existsSync(emlPath) || !existsSync(vecPath)) {
  console.log("SKIP: test fixtures absent (__test_email.eml / __test_vector.json)");
  process.exit(0);
}

const raw = readFileSync(emlPath); // Uint8Array (Buffer)
const vector = JSON.parse(readFileSync(vecPath, "utf8"));

const parsed = parseEml(new Uint8Array(raw));

const strip = (h) => (h.startsWith("0x") ? h.slice(2) : h);

let ok = true;
function check(label, actual, expected) {
  const pass = actual === expected;
  if (!pass) ok = false;
  console.log(`${pass ? "MATCH" : "FAIL "}  ${label}`);
  if (!pass) {
    console.log(`  expected: ${expected}`);
    console.log(`  actual:   ${actual}`);
    // Show first differing byte offset for canonicalization debugging.
    const n = Math.min(expected.length, actual.length);
    for (let i = 0; i < n; i++) {
      if (expected[i] !== actual[i]) {
        console.log(`  first diff at char ${i}: exp '${expected[i]}' act '${actual[i]}'`);
        console.log(`  ...exp: ${expected.slice(Math.max(0, i - 20), i + 20)}`);
        console.log(`  ...act: ${actual.slice(Math.max(0, i - 20), i + 20)}`);
        break;
      }
    }
    if (expected.length !== actual.length) {
      console.log(`  length exp=${expected.length} act=${actual.length}`);
    }
  }
}

check("signedHeaders === vector.signedData", strip(parsed.signedHeaders), vector.signedData);
check("signature === vector.signature", strip(parsed.signature), vector.signature);
check("domain === amazonses.com", parsed.domain, "amazonses.com");
check("selector", parsed.selector, vector.selector);

if (ok) {
  console.log("\nALL MATCH");
  process.exit(0);
} else {
  console.log("\nMISMATCH");
  process.exit(1);
}

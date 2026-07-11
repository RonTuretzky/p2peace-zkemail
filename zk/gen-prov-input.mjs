import { generateEmailVerifierInputs } from "@zk-email/helpers/dist/input-generators.js";
import { readFileSync, writeFileSync } from "node:fs";
const raw = readFileSync(process.argv[2]);
const inputs = await generateEmailVerifierInputs(raw, {
  maxHeadersLength: 640,
  ignoreBodyHashCheck: true,
});
console.log("keys:", Object.keys(inputs));
console.log("emailHeaderLength:", inputs.emailHeaderLength);
console.log("pubkey limbs:", inputs.pubkey?.length, "signature limbs:", inputs.signature?.length);
writeFileSync("build/prov-input-base.json", JSON.stringify(inputs));
console.log("wrote build/prov-input-base.json");

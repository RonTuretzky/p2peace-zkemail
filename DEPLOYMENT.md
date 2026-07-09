# Live deployment — Gnosis Chain (chain 100)

The full p2peace system is deployed and demo-configured on Gnosis Chain. The
frontend reads these addresses (baked into `app/lib/chains.ts`, and hydrated at
runtime from the `addresses` branch per the crowdstake convention).

Deployer / admin / guardian: `0x6636A1CCBdf54485067304C1a590DE016DeaD9F0`

| Contract | Address |
|---|---|
| MockUSD (reserve) | `0x9af75a83661885db1848511b345f5f8a4badb4c0` |
| DKIMRegistry | `0x85cc25bb555f4bd82a9a36244094e88fd451b760` |
| ZKEmailVerifier | `0x9239f82a992238ab9a69af374161c5c2e8ffea2c` |
| MockGroth16Verifier | `0x631a37682e18d34bfcc1416cf23e84df30bef326` |
| IdentityRegistry | `0x60feeb1453f0b06de75e3a1b66f681f563d40b3d` |
| PeaceToken A | `0x01b1a42aa56a623a437a7a55046784f43e8e27f0` |
| PeaceToken B | `0x64ddd68c9656e660531bc1fc7ece156e066aa0d7` |
| Treasury | `0xf335fd10b0cadbfa7c0c6d41c7d8936621df8b81` |
| CommunityPool A | `0x6a1c3f73444030ca5884454d58a40ad4e01319dc` |
| CommunityPool B | `0x72a5f2a70fb10843dc3cb17057fe6a860ca55605` |
| PeaceMinter A | `0x7a76cfa8668a425b3f0e598c27019cd9d0e922f9` |
| PeaceMinter B | `0x7d21e680becdd1b9909d61ac5af0221bea13ddf2` |
| IncentiveRegistry | `0x559b6fa3673cbd822d411d4cb921f1db8528d8af` |
| EventAttestation | `0x92ce3f819f2c2e588b7c3f3a609c0f70809f8640` |
| RedistributionEngine | `0xfdadb1d595e2bf55ac471f8a334ab73a2d191043` |
| DisputeCouncil | `0x907df415d4a0f25cfa7c787420e6a5dda3bb30b7` |
| SanctionsEscrow | `0x76ae564ab2509bacd266c1a460795fb9a11757f7` |
| BusinessRegistry | `0xcb8beb77bb449fbe717eead2511e1b045952b5f7` |

## Demo configuration (`DEMO_SETUP=true`)

- Both blueprints route to the `MockGroth16Verifier`, which accepts any Groth16
  proof — so the frontend builds a **structurally real** `EmailProof` (correct
  DKIM key hash, allowlisted domain, committed pattern, fresh timestamp) that
  passes every on-chain contract check without a WASM prover. In production the
  mock is swapped for compiled per-blueprint verifiers (see `circuits/`) and the
  demo proof builders are replaced by the zk-email SDK.
- Government domains: `taxes.gov-a.example` → Community A, `id.gov-b.example` →
  Community B. News sources: two A-press, two B-press, three international (see
  `app/lib/demo.ts` / `contracts/script/Deploy.s.sol:demoDomains`).
- Governance and dispute windows are compressed to **10 minutes** (vs 7d/3d/48h
  in production) so the full propose → vote → attest → dispute → claim loop is
  demoable in under an hour.

## Redeploying

```sh
cd contracts
PK=<key> DEMO_SETUP=true forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.gnosischain.com --private-key $PK --broadcast --slow
```

Then regenerate the frontend manifest + baked-in addresses from the broadcast
(the `addresses` branch / `app/public-addresses.json` / `app/lib/chains.ts`).
Because the frontend hydrates addresses at runtime from the `addresses` branch,
publishing a new manifest there makes a redeploy live **without** a frontend
rebuild.

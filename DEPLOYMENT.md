# Live deployment — Gnosis Chain (chain 100)

p2peace runs on Gnosis mainnet with **real sDAI as the reserve** and **real-world
domains** (btl.gov.il, gov.ps, timesofisrael.com, wafa.ps, reuters.com, apnews.com).

Deployer / admin / guardian: `0x6636A1CCBdf54485067304C1a590DE016DeaD9F0`

## Two verification paths, both live

- **Real email (genuine crypto).** `IdentityRegistry.registerReal` verifies a real
  email's DKIM RSA signature fully on-chain via `RealEmailVerifier`
  (`0x0e707f9e969c0b61d48e9efb62fbecf54e628a8b`) and enrolls you. Proven end-to-end
  against an actual `noreply@btl.gov.il` one-time-code email: signature VALID on-chain,
  tampered signature rejected, full `registerReal` enrolls as Community A. This proves
  **authenticity, not privacy** — the signed headers (incl. recipient) are public
  calldata. Keep amounts tiny and use a throwaway wallet.
- **Demo proof (mock).** `register` accepts a `MockGroth16Verifier` proof — every
  contract rule runs but the crypto doesn't, so anyone can register. For walking the
  flow only.

The registered real key is the Amazon SES key that signs `From: noreply@btl.gov.il`
(btl.gov.il's *direct* DKIM key rotated out of DNS since the email was sent — exactly
the key-archival case the design models; SES verified-sender enforcement means only
btl's SES account can send as that address).

| Contract | Address |
|---|---|
| sDAI (reserve, external) | `0xaf204776c7245bf4147c2612bf6e5972ee483701` |
| SavingsXDaiAdapter (xDAI→sDAI) | `0xD499b51fcFc66bd31248ef4b28d656d67E591A94` |
| RealEmailVerifier | `0x0e707f9e969c0b61d48e9efb62fbecf54e628a8b` |
| DKIMRegistry | `0x0aae0d2af6f73d3034490e4bbb17e897c57ae977` |
| ZKEmailVerifier | `0xd43380d3639096a2450b1e0ef235b4ddca8796f8` |
| MockGroth16Verifier | `0xaed7cf0fd62b547a02309b134a2cc89d053b2019` |
| IdentityRegistry | `0xab8758312f4dc3f50abb7f52ca4e65ecd19bd268` |
| PeaceToken A | `0x63be2cee6cb79bd4ff960e1c8a2b58514f033c1b` |
| PeaceToken B | `0x0b05d93822145f2f74dd59e10653fbd6a30d14b4` |
| Treasury | `0x63f166ab322cd26b195a57fe283284a5d8adb186` |
| CommunityPool A | `0x12785f81624e8c303f2b8dfba33d1e88d7fbf5d1` |
| CommunityPool B | `0xf31599c4ec89cae2ff26265e53e7508bce5af0c0` |
| PeaceMinter A | `0xe4e5456878f4760e75a56ce2c657c27b4fd54d2d` |
| PeaceMinter B | `0x9c76dfa376bd2ed0ce14c90e09e31425ece42b42` |
| IncentiveRegistry | `0x2d552aac74e5229240dcf727d6edc3e2c3a3f42d` |
| EventAttestation | `0x7150d600cf922eec337f0a0ada14b525f0dd530d` |
| RedistributionEngine | `0x241a51c7f3394538c883dce28af433c6908ce032` |
| SanctionsEscrow | `0x4f931f24462d4b53a0475c98a00cad74d32d0a70` |

## Real-world domains

| Role | Domain | Notes |
|---|---|---|
| Community A gov | `btl.gov.il` | Israeli National Insurance — `noreply@btl.gov.il` (the real-email path is wired for this) |
| Community B gov | `gov.ps` | Palestinian Authority |
| A-side press | `timesofisrael.com` | Times of Israel Daily Edition newsletter |
| B-side press | `wafa.ps` | WAFA — Palestine News Agency |
| International | `reuters.com`, `apnews.com` | daily email briefings |

Governance and notice windows are compressed to **10 minutes** (production: 7d/3d/48h).

## How to test with your own btl.gov.il email

1. In Gmail, open a `noreply@btl.gov.il` email → ⋮ → **Download message** (`.eml`).
2. On `/verify`, connect a wallet on Gnosis (a little xDAI for gas), choose
   **Verify with your real email**, and upload the `.eml`. The DKIM signature is parsed
   and canonicalized in your browser; only the signed headers + signature are submitted
   to `registerReal`, which verifies the RSA signature on-chain.
3. Privacy caveat applies — this path is authentic but public. For real privacy, the
   zkEmail circuit path (in `circuits/`) is the production upgrade.

## Redeploying

```sh
cd contracts
PK=<key> RESERVE_TOKEN=0xaf204776c7245bF4147c2612BF6e5972Ee483701 DEMO_SETUP=true \
  EMAIL_DOMAIN=<dkim d=> EMAIL_SELECTOR=<dkim s=> EMAIL_SENDER=noreply@btl.gov.il \
  EMAIL_MODULUS=0x<rsa n> EMAIL_EXP=0x010001 \
  forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.gnosischain.com \
  --private-key $PK --broadcast
```

Extract a key's `EMAIL_MODULUS` from a `.eml` with the helper in `contracts/` (dkimpy /
`node lib/dkim.test.mjs`). Then refresh `app/lib/chains.ts`,
`app/public-addresses.json`, and the `addresses` branch.

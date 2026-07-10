# Live deployment — Gnosis Chain (chain 100)

p2peace runs on Gnosis mainnet with **real sDAI as the reserve** and **real-world
domains** (btl.gov.il, gov.ps, timesofisrael.com, wafa.ps, reuters.com, apnews.com).

Deployer / admin / guardian: `0x6636A1CCBdf54485067304C1a590DE016DeaD9F0`

## Two verification paths, both live

- **Real email (genuine crypto).** `IdentityRegistry.registerReal` verifies a real
  email's DKIM RSA signature fully on-chain via `RealEmailVerifier`
  (`0x6Ac204183EBE2AFe11097ae697FF1Af0F5A3dA44`) and enrolls you. Proven end-to-end
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
| RealEmailVerifier | `0x6Ac204183EBE2AFe11097ae697FF1Af0F5A3dA44` |
| DKIMRegistry | `0xdfba380eb408444d1d418bf23994274f15cdd3c0` |
| ZKEmailVerifier | `0x63babfa2d223ee34403e88a6272842ee778ad2a3` |
| MockGroth16Verifier | `0xf3ea51f794b2eb1a417f37ba5e69f87762e0d2ca` |
| IdentityRegistry | `0xa9f9a182010776e41cbec5293f52f2c61bc47403` |
| PeaceToken A | `0xd1454cccc2777af3042a4f557768cc80a427f468` |
| PeaceToken B | `0x84e75d03db712847a80493d24b4a957bc4680986` |
| Treasury | `0x9bc24488e88089c5e178d7a5a7e47f609725fa1c` |
| CommunityPool A | `0x9a6645e7fa1cdb2c580173915581a9adcf5e2d5e` |
| CommunityPool B | `0xa676c72b9ad2acb68253757387b5bd2c326bef87` |
| PeaceMinter A | `0xeeaf1893229d69a003a8e1e6548fec383df87e39` |
| PeaceMinter B | `0x21172a8a553c65c6d68fe2c7241b444cb62dc5f5` |
| IncentiveRegistry | `0xa82e9f91265ff9bd86dc516d86b4fc082ee814bd` |
| EventAttestation | `0xb65ad8b3f3cfd68e0cd4e46dca0669885bf1d367` |
| RedistributionEngine | `0x0ba7ac918f664ab4707ca8d0c69e8c4d06e59143` |
| SanctionsEscrow | `0x07a1f0b3d83bf3517199ffa123bd56c48c0efbd4` |

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
  --private-key $PK --broadcast --slow
```

Extract a key's `EMAIL_MODULUS` from a `.eml` with the helper in `contracts/` (dkimpy /
`node lib/dkim.test.mjs`). Then refresh `app/lib/chains.ts`,
`app/public-addresses.json`, and the `addresses` branch.

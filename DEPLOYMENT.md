# Live deployment — Gnosis Chain (chain 100)

The current p2peace instance runs on Gnosis mainnet with **real sDAI as the reserve
asset** and **real-world domains**. The frontend reads these addresses (baked into
`app/lib/chains.ts`, hydrated at runtime from the `addresses` branch).

Deployer / admin / guardian: `0x6636A1CCBdf54485067304C1a590DE016DeaD9F0`

> ⚠️ **Demo-verifier warning.** Identity and event proofs are checked by a
> `MockGroth16Verifier` that accepts any proof — every *contract-level* rule
> (domains, nullifiers, windows, thresholds, dual majority) is enforced, but the
> cryptographic proof itself is not. Anyone can therefore register any identity and
> attest any event. **Keep amounts small**: this instance exists so the flows can be
> walked with real value plumbing, not to custody meaningful funds. Swapping in
> compiled per-blueprint verifiers (see `circuits/`) removes this caveat without
> changing any other contract.

| Contract | Address |
|---|---|
| sDAI (reserve, external) | `0xaf204776c7245bf4147c2612bf6e5972ee483701` |
| DKIMRegistry | `0x43f2e6b56ee3cf61c3e8e6b9f9cca71fb188cd66` |
| ZKEmailVerifier | `0xb4f9ffa1215b462a6661626d0dce1f47cba5fb19` |
| MockGroth16Verifier | `0x32c2fe41a8f23611eb494748cdb086e7c4cef2ea` |
| IdentityRegistry | `0x25568a8bbedbe159b28650a64e068dc7de40b77e` |
| PeaceToken A | `0x665b7b61d0bb1f196d58355664e32b34f44553a5` |
| PeaceToken B | `0x850a0e366727866bcffed4954b2bbfaa42ea85f1` |
| Treasury | `0x1a69d7149f2e0841d18b98213ca78f1cc41a8b90` |
| CommunityPool A | `0x950f15d5fd65534dc62b357787eecd7455146aef` |
| CommunityPool B | `0xfeb17043e4c8665eb903b17c9c3511d9f3274e71` |
| PeaceMinter A | `0xa8aa119634a7fe9f6b34f7911a8cdfe3ac4cd6ca` |
| PeaceMinter B | `0x07f951d3cfa9a8747e9e2d1a12f1f527ecb3b148` |
| IncentiveRegistry | `0xc1a08810bf50963023dd803dda0f84986324b2f3` |
| EventAttestation | `0x81f24c3d6eaadb9d612395d0d399d863ba9c80b1` |
| RedistributionEngine | `0xcdc2737707b974f0a33af17ced55511348ac38e1` |
| SanctionsEscrow | `0xfecb1f5b1a917493055f3e94c564ff8e58f6b12d` |

## Real-world configuration

| Role | Domain | Why |
|---|---|---|
| Community A government | `btl.gov.il` | Israeli National Insurance Institute — sends from `noreply@btl.gov.il`, an email virtually every Israeli resident receives |
| Community B government | `gov.ps` | Palestinian Authority portal |
| A-side press | `timesofisrael.com` | Times of Israel **Daily Edition** — real daily email newsletter ([signup](https://www.timesofisrael.com/signup)) |
| B-side press | `wafa.ps` | WAFA — Palestine News Agency |
| International wires | `reuters.com`, `apnews.com` | Both run daily email briefings |

Governance and notice windows are compressed to **10 minutes** (production defaults:
7d discussion / 3d vote / 48h notice). Confirmed events settle after the notice
window; the guardian's auto-expiring pause is the emergency brake.

## Getting sDAI

The reserve is Savings xDAI. Swap a little xDAI → sDAI on Gnosis (e.g.
[CoW Swap](https://swap.cow.fi/#/100/swap/XDAI/sDAI)), then approve and convert on
the `/mint` page. Redemption back to sDAI is 1:1 at any time (except the 10% pledge).

## Redeploying

```sh
cd contracts
PK=<key> RESERVE_TOKEN=0xaf204776c7245bF4147c2612BF6e5972Ee483701 DEMO_SETUP=true \
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.gnosischain.com --private-key $PK --broadcast --slow
```

Omit `RESERVE_TOKEN` to deploy with a free-mint MockUSD faucet instead. Then refresh
`app/lib/chains.ts`, `app/public-addresses.json`, and the `addresses` branch —
runtime hydration makes a redeploy live without a frontend rebuild.

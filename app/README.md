# p2peace frontend (zkEmail)

The Next.js concept/marketing site for **p2p2p (peer to peer to peace)** — a decentralized
protocol for economic peacebuilding between citizens of conflicting nations, founded on
**zkEmail** (zero-knowledge proofs over DKIM-signed emails).

This app is the original v0 concept site adapted to the implemented zkEmail architecture:
identity via government-domain email proofs, permissionless news-event attestation by any
newsletter subscriber, opt-in peace pools (10% mint stake), identity-gated quadratic
governance with dual majority, and Treasury-funded positive rewards.

## Part of the p2peace monorepo

| Path | Contents |
|---|---|
| `../contracts` | Foundry project — IdentityRegistry, EventAttestation, PeaceMinter, CommunityPools, RedistributionEngine, SanctionsEscrow, BusinessRegistry, governance |
| `../circuits` | zkEmail blueprint specs (citizenship + news-event), zk-regex notes, proving walkthrough |
| `../docs` | ARCHITECTURE.md, IMPROVEMENTS.md, ZKEMAIL-DESIGN.md, THREAT-MODEL.md — the source of truth this site reflects |
| `.` (this app) | Concept site with interactive demo pages |

## Pages

- `/` — overview and navigation
- `/verification` — the zkEmail verification system (identity + event proofs)
- `/attest` — interactive demo of attesting an event from a newsletter `.eml`
- `/docs` — mermaid sequence diagrams of every implemented flow
- `/economic-incentives`, `/governance`, `/token-economics` — mechanism explanations
- `/propose-incentive`, `/external-incentives`, `/user-demos` — lifecycle walkthroughs

## Development

```bash
pnpm install
pnpm dev     # http://localhost:3000
pnpm build   # production build
```

Built with Next.js 14 (App Router), Tailwind CSS, shadcn/ui, and mermaid for diagrams.
The attestation demo is static; wiring the real zk-email SDK prover and contract calls is
future work (the contracts and circuit specs it would target live in the sibling
directories above).

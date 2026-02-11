# OpenTel

Open-source alternative to commercial call/contact center platforms (NICE, Genesys Cloud). Self-hostable call infrastructure with no vendor lock-in.

## Quick Start

### 1. Start Infrastructure

```bash
docker-compose -f infra/docker-compose.yml up -d
```

Runs Postgres, Redis, NATS, coturn, Prometheus, and Grafana.

### 2. Install & Migrate

```bash
pnpm install
pnpm db:migrate
```

### 3. Start Services

```bash
pnpm dev
```

API: http://localhost:3000  
Signaling: http://localhost:3001  
Docs: http://localhost:3000/docs  
Grafana: http://localhost:3002 (admin/admin)

### 4. First Call

```bash
pnpm opentel create-tenant Acme
pnpm opentel create-endpoint <tenantId> Alice
pnpm opentel create-endpoint <tenantId> Bob
pnpm opentel mint-token <tenantId> <aliceEndpointId>
pnpm opentel mint-token <tenantId> <bobEndpointId>
```

Open `infra/dev.html` in two browser tabs. Paste tokens and endpoint IDs, connect, then dial.

## Structure

- `apps/api` — REST API (tenants, endpoints, tokens, calls)
- `apps/signaling` — WebSocket signaling for WebRTC
- `apps/demo-cli` — CLI for provisioning
- `apps/config-wizard` — Configuration wizard (Next.js + Fluent UI) — `pnpm dev:wizard` for port 3003
- `packages/schemas` — Zod schemas
- `packages/core` — Call state machine
- `packages/auth` — JWT mint/verify
- `packages/events` — NATS + webhooks
- `packages/storage` — Postgres + Redis
- `packages/errors` — Error codes
- `packages/client-sdk` — Browser SDK
- `packages/server-sdk` — Node.js SDK

## Docs

- [EMBEDDING_GUIDE](docs/EMBEDDING_GUIDE.md) — Integrate OpenTel into a CRM or app (backend + frontend + webhooks)
- [GITFLOW](docs/GITFLOW.md) — Branching and commits
- [ERROR_CODES](docs/ERROR_CODES.md) — API error catalog
- [GRAFANA_SETUP](docs/GRAFANA_SETUP.md) — Admin dashboard
- [PHASE2_PSTN](docs/PHASE2_PSTN.md) — PSTN/SIP/SBC roadmap and setup

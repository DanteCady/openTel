# OpenTel

<p align="center">
  <img src="assets/logo.png" alt="OpenTel" width="160" />
</p>

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

Run everything (Docker + all four apps) with `pnpm dev`. If you get **address already in use**, run `pnpm dev:free` then `pnpm dev` again. See [docs/PORTS.md](docs/PORTS.md) for the full port map and troubleshooting.

### 4. First Call

```bash
pnpm opentel create-tenant Acme
pnpm opentel create-endpoint <tenantId> Alice
pnpm opentel create-endpoint <tenantId> Bob
pnpm opentel mint-token <tenantId> <aliceEndpointId>
pnpm opentel mint-token <tenantId> <bobEndpointId>
```

Start the first-call demo app (Fluent UI, port 3004):

```bash
pnpm dev:demo
```

Open http://localhost:3004 in two browser tabs. Paste tokens and endpoint IDs (Alice in one tab, Bob in the other), click **Connect & Register**, then **Dial** from one tab and **Answer** in the other. Alternatively, use the static `infra/dev.html` (e.g. open the file or serve the repo and open `/infra/dev.html`).

## Structure

- `apps/api` — REST API (tenants, endpoints, tokens, calls)
- `apps/signaling` — WebSocket signaling for WebRTC
- `apps/demo-cli` — CLI for provisioning
- `apps/config-wizard` — Configuration wizard (Next.js + Fluent UI) — `pnpm dev:wizard` (port 3003)
- `apps/dev-demo` — First-call demo (Next.js + Fluent UI) — `pnpm dev:demo` (port 3004)
- `packages/schemas` — Zod schemas
- `packages/core` — Call state machine
- `packages/auth` — JWT mint/verify
- `packages/events` — NATS + webhooks
- `packages/storage` — Postgres + Redis
- `packages/errors` — Error codes
- `packages/client-sdk` — Browser SDK
- `packages/server-sdk` — Node.js SDK

## Docs

- [COMMANDS](docs/COMMANDS.md) — All pnpm scripts and CLI commands
- [EMBEDDING_GUIDE](docs/EMBEDDING_GUIDE.md) — Integrate OpenTel into a CRM or app (backend + frontend + webhooks)
- [GITFLOW](docs/GITFLOW.md) — Branching and commits
- [ERROR_CODES](docs/ERROR_CODES.md) — API error catalog
- [GRAFANA_SETUP](docs/GRAFANA_SETUP.md) — Admin dashboard
- [PHASE2_PSTN](docs/PHASE2_PSTN.md) — PSTN/SIP/SBC roadmap and setup

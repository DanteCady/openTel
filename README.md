# OpenTel

<p align="center">
  <img src="assets/logo.png" alt="OpenTel" width="160" />
</p>

**Open-source, self-hosted call infrastructure.** Use it as the backbone for contact centers, CRMs, or any app that needs voice: tenants, endpoints, tokens, WebSocket signaling, call state, and webhooks. No vendor lock-in.

- **WebRTC-only:** Browser-to-browser or app-to-app calls with no phone network. OpenTel does signaling and state; you run TURN (e.g. coturn) for media.
- **PSTN:** Call or receive real phone numbers by adding **FreeSWITCH** and your own SBC/SIP trunk. OpenTel controls the gateway via ESL; same APIs and webhooks for both WebRTC and PSTN.

---

## Quick Start

### 1. Start infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d
```

Runs Postgres, Redis, NATS, coturn, Prometheus, and Grafana.

### 2. Install and migrate

```bash
pnpm install
pnpm db:migrate
```

### 3. Start OpenTel

```bash
pnpm dev
```

| Service      | URL                      |
|-------------|---------------------------|
| API         | http://localhost:3000     |
| API docs    | http://localhost:3000/docs |
| Signaling   | http://localhost:3001    |
| Grafana     | http://localhost:3002 (admin/admin) |

To run everything (Docker + API, Signaling, config wizard, dev-demo) in one command: `pnpm dev`. If you get **address already in use**, run `pnpm dev:free` then `pnpm dev` again. See [docs/PORTS.md](docs/PORTS.md).

### 4. First call (WebRTC)

```bash
pnpm opentel create-tenant Acme
pnpm opentel create-endpoint <tenantId> Alice
pnpm opentel create-endpoint <tenantId> Bob
pnpm opentel mint-token <tenantId> <aliceEndpointId>
pnpm opentel mint-token <tenantId> <bobEndpointId>
```

Start the demo app:

```bash
pnpm dev:demo
```

Open http://localhost:3004 in two browser tabs. Paste tokens and endpoint IDs (Alice in one, Bob in the other), click **Connect & Register**, then **Dial** and **Answer**. Or use `infra/dev.html` for a minimal test page.

---

## When do I need FreeSWITCH?

- **WebRTC-only** (calls between your app’s users, no phone numbers): you **don’t** need FreeSWITCH. OpenTel + TURN is enough.
- **PSTN** (dial out to or receive calls from real phone numbers): you **do** need **FreeSWITCH** (and an SBC/SIP trunk). OpenTel’s gateway-client talks to FreeSWITCH over ESL to originate calls and receive inbound-call notifications. See [docs/PHASE2_PSTN.md](docs/PHASE2_PSTN.md) and [docs/DIAGRAMS.md](docs/DIAGRAMS.md).

---

## Repo structure

| Path | Purpose |
|------|---------|
| **apps/api** | REST API: tenants, endpoints, tokens, calls, queues, auth, channels (email/SMS), OpenAPI at `/docs`. |
| **apps/signaling** | WebSocket signaling for WebRTC (auth, register, dial, answer, SDP/ICE). Uses gateway-client for PSTN. |
| **apps/config-wizard** | Setup wizard (DB, Redis, NATS, JWT, TURN, SIP/SBC). `pnpm dev:wizard` (port 3003). |
| **apps/dev-demo** | First-call demo. `pnpm dev:demo` (port 3004). |
| **apps/ccaas** | Contact-center UI (agents, queues, workspace). `pnpm dev:ccaas` (port 3005). |
| **apps/demo-cli** | CLI: `pnpm opentel` for create-tenant, create-endpoint, mint-token, etc. |
| **packages/gateway-client** | FreeSWITCH ESL client: originate, hangup, inbound-call handler. |
| **packages/client-sdk** | Browser SDK: connect, register, dial, answer, hangup, ICE. |
| **packages/server-sdk** | Node.js SDK: create tenant/endpoints, mint tokens, list calls. |
| **packages/storage** | Postgres + Redis (tenants, endpoints, calls, presence, queues, etc.). |
| **packages/events** | NATS pub/sub + webhook delivery (with retries). |
| **packages/core** | Call state machine. |
| **packages/auth** | JWT mint/verify. |
| **packages/schemas** | Zod schemas. |
| **packages/errors** | Error codes and HTTP mapping. |
| **infra** | Docker Compose (dev and prod), Prometheus, Grafana. |

---

## Docs

| Doc | Description |
|-----|--------------|
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Components, data flow, multi-tenancy, Phase 2/PSTN. |
| [DIAGRAMS](docs/DIAGRAMS.md) | System overview, media architecture, embedding flow, SBC/FreeSWITCH integration. |
| [EMBEDDING_GUIDE](docs/EMBEDDING_GUIDE.md) | Integrate OpenTel into a CRM or app (backend + frontend + webhooks). |
| [PHASE2_PSTN](docs/PHASE2_PSTN.md) | PSTN setup: FreeSWITCH, SBC, trunk, inbound-call, bridge-on-answer. |
| [DEPLOYMENT](docs/DEPLOYMENT.md) | Production deploy, env vars, secrets, scaling, runbooks. |
| [SECURITY](docs/SECURITY.md) | Admin token, securing `/inbound-call`, rate limiting. |
| [API_VERSIONING](docs/API_VERSIONING.md) | Compatibility and upgrade policy. |
| [COMMANDS](docs/COMMANDS.md) | pnpm scripts and CLI. |
| [ERROR_CODES](docs/ERROR_CODES.md) | API error catalog. |
| [GRAFANA_SETUP](docs/GRAFANA_SETUP.md) | Metrics and dashboards. |
| [PORTS](docs/PORTS.md) | Port map and troubleshooting. |

---

## Production

- Use the production compose file and env from [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (e.g. `docker compose -f infra/docker-compose.prod.yml --env-file .env.prod up -d` for infra; run API and Signaling with the same env).
- Set `JWT_SECRET` and production DB/Redis/NATS URLs; optionally secure `POST /inbound-call` with `OPENTEL_INBOUND_SECRET` and/or `OPENTEL_INBOUND_ALLOWED_IPS`.
- OpenAPI at `http://<api>/docs` is the single API reference.

# OpenTel Production Deployment

This document describes how to run OpenTel in production: deploy path, environment variables, secrets, scaling, and operations.

---

## Production deploy path

### Option 1: Docker Compose (single-node)

1. **Infrastructure**: Run Postgres, Redis, NATS, coturn, Prometheus, and Grafana with the production compose file.

   ```bash
   # From repo root. Create .env.prod first (see Secrets and env below).
   docker compose -f infra/docker-compose.prod.yml --env-file .env.prod up -d
   ```

   See [infra/docker-compose.prod.yml](../infra/docker-compose.prod.yml). It uses `restart: unless-stopped` and expects `POSTGRES_PASSWORD` and `GF_ADMIN_PASSWORD` (and optional `POSTGRES_USER`, `POSTGRES_DB`, `GF_ADMIN_USER`) to be set in `.env.prod`.

2. **API and Signaling**: Run on the host or in your orchestrator (e.g. systemd, PM2, or Kubernetes).

   ```bash
   pnpm build
   pnpm db:migrate   # run migrations against production DATABASE_URL
   # API
   node apps/api/dist/server.js        # set env from .env.prod or your secret manager
   # Signaling (separate process)
   node apps/signaling/dist/server.js
   ```

   Use the same `.env.prod` (or equivalent) so `DATABASE_URL`, `REDIS_URL`, `NATS_URL`, `JWT_SECRET`, `API_PORT`, `SIGNALING_PORT`, etc. match the infrastructure.

3. **Migrations**: Migrations are idempotent. Run `pnpm db:migrate` after deploy or as a release step. If you see "column already exists", ensure you are on the latest migration code and run again.

### Option 2: Kubernetes / Helm

A minimal Helm chart is not included in this repo. For Kubernetes you would:

- Run Postgres, Redis, NATS (or use managed services).
- Deploy API and Signaling as deployments; point them at the same DB, Redis, and NATS.
- Use a single replica of Signaling per namespace (or use sticky sessions and document scaling limits; see Scaling below).
- Run migrations as a Job or init container.

---

## Environment variables: required vs optional

Use [.env.example](../.env.example) as a template. For production, create `.env.prod` (or use a secrets manager) and never commit it.

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Postgres (or MySQL) connection string. Use TLS in production. |
| `REDIS_URL` | Yes | Redis connection string. |
| `NATS_URL` | Yes | NATS connection string (e.g. `nats://nats:4222` when API/signaling run in same network as infra). |
| `JWT_SECRET` | Yes | Secret for signing tokens. Rotate periodically; see [docs/SECURITY.md](SECURITY.md). |
| `API_PORT` | No | Default 3000. |
| `SIGNALING_PORT` | No | Default 3001. |
| `API_BASE_URL` | No | Base URL for OAuth callbacks (e.g. `https://api.example.com`). |
| `STUN_URL` / `TURN_URL` | No | WebRTC; default to your coturn host. |
| `OPENTEL_GATEWAY_URL` | No | Phase 2 PSTN; FreeSWITCH ESL URL. |
| `OPENTEL_SIP_TRUNK_*` | No | Phase 2 SIP trunk config. |
| `OPENTEL_INBOUND_TENANT_ID` / `OPENTEL_INBOUND_DEFAULT_ENDPOINT_ID` | No | Phase 2 inbound PSTN. |
| `OPENTEL_INBOUND_SECRET` | No | If set, secures `POST /inbound-call` (see [SECURITY.md](SECURITY.md)). |
| `OTEL_*` | No | OpenTelemetry; see [TELEMETRY.md](TELEMETRY.md). |
| `SECRETS_PROVIDER` / `SECRETS_ENCRYPTION_KEY` | No | Channel secrets; see [CHANNELS_DESIGN.md](CHANNELS_DESIGN.md). |
| OAuth (`GMAIL_*`, `MICROSOFT_*`) | No | For email channels. |
| `RATE_LIMIT_ENABLED` | No | Set to `1` or `true` to enable API rate limiting (per-tenant or per-IP). |
| `RATE_LIMIT_MAX` | No | Max requests per window (default 200). |
| `RATE_LIMIT_TIME_WINDOW_MS` | No | Window in ms (default 60000). |

**Production compose only** (for [infra/docker-compose.prod.yml](../infra/docker-compose.prod.yml)):

| Variable | Required | Notes |
|----------|----------|--------|
| `POSTGRES_PASSWORD` | Yes | Postgres superuser password. |
| `POSTGRES_USER` | No | Default `opentel`. |
| `POSTGRES_DB` | No | Default `opentel`. |
| `GF_ADMIN_PASSWORD` | Yes | Grafana admin password. |
| `GF_ADMIN_USER` | No | Default `admin`. |

---

## Secrets and env in production

- **Do not commit** `.env.prod` or any file containing `JWT_SECRET`, `DATABASE_URL`, or webhook URLs.
- **Prefer a secrets manager** (e.g. HashiCorp Vault, AWS Secrets Manager, or your cloud’s secret store) and inject env at runtime. Alternatively, use Docker secrets or Kubernetes Secrets and pass them as env to API/signaling.
- **Webhook URLs** are stored per tenant in the database; ensure the API is only reachable over HTTPS and that tenant tokens are scoped and rotated as needed.
- **JWT_SECRET**: Use a long random value (e.g. 32+ bytes). Rotate by minting a new admin token with the new secret and retiring the old one; see [SECURITY.md](SECURITY.md).

---

## Scaling

- **Single-node**: One API process and one Signaling process is the default and sufficient for many teams. All state is in Postgres, Redis, and NATS; only Signaling keeps in-memory WebSocket state.
- **Signaling is stateful**: The Signaling server holds an in-memory map of connected WebSocket clients (see [apps/signaling/src/server.ts](../apps/signaling/src/server.ts)). On restart, that map is lost; clients must reconnect and in-flight calls can drop. For multiple Signaling instances you need:
  - **Sticky routing**: Route each client to the same Signaling instance (e.g. by cookie or consistent hash of endpoint/tenant id).
  - **Shared presence/registration**: A future design could move registration state to Redis so that reconnects can find the right instance; not implemented today.
- **API**: Can be scaled horizontally; it is stateless aside from DB/Redis/NATS.

---

## High availability (optional)

- **Single-node limits**: One API + one Signaling means one point of failure. In-flight calls do not survive a Signaling restart.
- **What HA would require**: Multiple Signaling instances with sticky sessions and a shared registration/presence layer (e.g. Redis); or a single Signaling with active/passive failover. Not required for many deployments; document your needs and plan accordingly.

---

## Health and dependencies

- **API** and **Signaling** each expose `/health` (simple liveness) and `/metrics` (Prometheus). Use `/health` for liveness probes; use `/metrics` for dashboards and alerting (see [GRAFANA_SETUP.md](GRAFANA_SETUP.md)).
- **Dependency health** (DB, Redis, NATS): The current `/health` endpoints do not check dependencies. For readiness, add DB/Redis/NATS checks to `/health` in your fork, or rely on your platform’s health checks and exporters.
- **Monitoring**: Use [infra/prometheus.yml](../infra/prometheus.yml) and Grafana to monitor API and Signaling metrics and dependency health (DB/Redis/NATS from your platform or exporters).

---

## Webhook delivery

Webhook delivery uses **retries with exponential backoff** (3 attempts: 500 ms, 1 s, 2 s). Failures are logged with event name, redacted URL, and last error. Delivery is non-blocking so request handlers do not wait for the final outcome.

---

## Runbooks

- **Signaling restarts**: In-memory socket map is lost; clients must reconnect. Document reconnection behavior (e.g. client SDK auto-reconnect) and that in-flight calls may drop. See also [READINESS.md](READINESS.md).
- **Migrations**: Run `pnpm db:migrate` after pulling new code that includes migrations. Migrations are idempotent; safe to run multiple times.
- **Rotating JWT_SECRET**: See [SECURITY.md](SECURITY.md).

# OpenTel commands

Reference for root `package.json` scripts. Run from repo root with `pnpm <script>`.

## Install

| Command | Description |
|---------|-------------|
| `pnpm i` | Install dependencies (alias for `pnpm install`). |

## Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Docker (Postgres, Redis, NATS, etc.), wait for NATS, then run all four apps: API, signaling, config-wizard, dev-demo (ports 3000, 3001, 3003, 3004). One command for the full stack. |
| `pnpm dev:wizard` | Run config wizard only (port 3003). |
| `pnpm dev:demo` | Run first-call demo app only (port 3004). |
| `pnpm dev:free` | Kill processes on ports 3000, 3001, 3003, 3004. Use after EADDRINUSE, then run `pnpm dev` again. |

## Build, test, lint

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages (Turbo). |
| `pnpm test` | Run tests (Turbo). |
| `pnpm lint` | Lint all packages (Turbo). |
| `pnpm format` | Format with Prettier (`**/*.{ts,tsx,js,json,md}`). |

## Database

| Command | Description |
|---------|-------------|
| `pnpm db:migrate` | Run storage migrations (uses `DATABASE_URL` from `.env`). |

## Setup & automation

| Command | Description |
|---------|-------------|
| `pnpm autoconfigure` | Start Docker, wait for Postgres, ensure DB and `.env`, run migrations. |
| `pnpm skip-wizard` | Same as `autoconfigure` (for testing without the config wizard). |

## CLI (demo / provisioning)

| Command | Description |
|---------|-------------|
| `pnpm opentel <cmd> [args]` | Run the demo CLI. Examples: |
| `pnpm opentel create-tenant <name>` | Create a tenant. |
| `pnpm opentel create-endpoint <tenantId> <label>` | Create an endpoint (e.g. Alice, Bob). |
| `pnpm opentel mint-token <tenantId> [endpointId]` | Mint a JWT for the tenant (and optionally an endpoint). |
| `pnpm opentel demo-setup` | Create tenant Acme, endpoints Alice & Bob, mint tokens; prints copy-paste for two dev-demo tabs. |
| `pnpm opentel quickstart` | Print first-call steps. |
| `pnpm opentel admin-token` | Mint bootstrap admin token. |
| `pnpm opentel set-webhook <tenantId> <url>` | Set tenant webhook URL. |

## See also

- [PORTS.md](PORTS.md) — Port map and troubleshooting (EADDRINUSE, NATS).
- [README.md](../README.md) — Quick start and first call.

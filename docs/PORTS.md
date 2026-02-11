# Ports Reference

No overlap between Docker and OpenTel apps. Use this when troubleshooting **EADDRINUSE** (e.g. after a previous `pnpm dev` that didn't exit cleanly).

## Docker (infra/docker-compose.yml)

| Service    | Host port | Notes        |
|-----------|-----------|--------------|
| Postgres  | 5433      | Container 5432 |
| MySQL     | 3306      |              |
| Redis     | 6379      |              |
| NATS      | 4222      |              |
| coturn    | 3478 (tcp/udp) | STUN/TURN |
| Prometheus| 9090      |              |
| Grafana   | **3002**   | Container 3000 → host 3002 |

## OpenTel apps (pnpm dev)

| App            | Port | Env / config        |
|----------------|------|---------------------|
| API            | **3000** | `API_PORT`       |
| Signaling      | **3001** | `SIGNALING_PORT` |
| Config wizard  | **3003** | next dev -p 3003 |
| Dev demo       | **3004** | next dev -p 3004 |

Docker does **not** use 3000, 3001, 3003, or 3004. Conflicts are from leftover Node/Next processes.

## If you get NATS CONNECTION_REFUSED (port 4222)

Docker must be running so NATS is up. Start infra: `docker-compose -f infra/docker-compose.yml up -d`. If Docker is running but you still see `ECONNREFUSED ::1:4222`, set `NATS_URL=nats://127.0.0.1:4222` in `.env` (Node may resolve `localhost` to IPv6 while Docker exposes IPv4).

## If you get "address already in use"

1. Stop any other terminal running `pnpm dev` (Ctrl+C).
2. Free the app ports, then start again:

   ```bash
   pnpm dev:free
   pnpm dev
   ```

   Or manually (macOS/Linux):

   ```bash
   for p in 3000 3001 3003 3004; do lsof -ti:$p | xargs -r kill -9 2>/dev/null; done
   ```

   On macOS, use: `lsof -ti:3000,3001,3003,3004 | xargs kill -9` (omit `-r`).

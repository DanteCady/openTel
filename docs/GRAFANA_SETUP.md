# Grafana Admin Dashboard

OpenTel includes Grafana for admin monitoring.

## Access

- **URL**: http://localhost:3002
- **Default credentials**: admin / admin (change on first login)

## Setup

1. Start infrastructure: `docker-compose -f infra/docker-compose.yml up -d`
2. Start OpenTel: `pnpm dev` (API on 3000, Signaling on 3001)
3. Grafana and Prometheus start with docker-compose
4. Prometheus is pre-provisioned as the default datasource

## Metrics

- **API**: `/metrics` on port 3000 — request counts, latency, default Node.js metrics
- **Signaling**: `/metrics` on port 3001 — `opentel_ws_connections_total`, `opentel_calls_created_total`, `opentel_calls_ended_total`

## Suggested Dashboards

Create panels for:
- Active WebSocket connections (`opentel_ws_connections_total`)
- Calls created over time (`opentel_calls_created_total`)
- Calls ended over time (`opentel_calls_ended_total`)
- HTTP request duration (Prometheus default metrics)

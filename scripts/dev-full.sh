#!/usr/bin/env bash
# Start Docker infra, wait for NATS, then run all OpenTel apps.
# One command to run everything. Ctrl+C stops only the apps; Docker keeps running.

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Starting Docker (Postgres, Redis, NATS, coturn, etc.)..."
docker compose -f infra/docker-compose.yml up -d

echo "==> Waiting for NATS (port 4222)..."
MAX_ATTEMPTS=30
ATTEMPT=0
until (nc -z 127.0.0.1 4222 2>/dev/null) || ([ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]); do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "WARN: NATS not ready in time; signaling may fail. Start Docker and run again."
    break
  fi
  sleep 1
done
if nc -z 127.0.0.1 4222 2>/dev/null; then
  echo "  NATS is ready."
fi

echo "==> Starting OpenTel apps (API, signaling, config-wizard, dev-demo)..."
exec pnpm turbo run dev --parallel --filter=./apps/api --filter=./apps/signaling --filter=./apps/config-wizard --filter=./apps/dev-demo

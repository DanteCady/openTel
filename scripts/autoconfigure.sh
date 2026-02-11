#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> OpenTel autoconfigure"
echo ""

# 1. Start Docker services (idempotent)
echo "==> Starting Docker services..."
docker compose -f infra/docker-compose.yml up -d

# 2. Wait for Postgres to be ready
echo "==> Waiting for Postgres..."
MAX_ATTEMPTS=30
ATTEMPT=0
until docker compose -f infra/docker-compose.yml exec -T postgres pg_isready -U postgres 2>/dev/null; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "ERROR: Postgres did not become ready in time"
    exit 1
  fi
  echo "  Waiting for Postgres... ($ATTEMPT/$MAX_ATTEMPTS)"
  sleep 2
done
echo "  Postgres is ready."

# 3. Ensure opentel database exists (Postgres)
echo "==> Ensuring database 'opentel' exists (Postgres)..."
docker compose -f infra/docker-compose.yml exec -T postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'opentel'" | grep -q 1 \
  || docker compose -f infra/docker-compose.yml exec -T postgres psql -U postgres -c "CREATE DATABASE opentel"
echo "  Postgres database ready."

# 4. Ensure .env exists (copy from .env.example if missing)
if [ ! -f .env ]; then
  echo "==> Creating .env from .env.example..."
  cp .env.example .env
  echo "  Created .env (review and edit as needed)"
else
  echo "==> .env already exists"
fi

# Use port 5433 for Postgres (avoids conflict with local Postgres on 5432)
if grep -q 'localhost:5432' .env 2>/dev/null; then
  echo "==> Updating .env to use port 5433 (Docker Postgres)..."
  sed -i.bak 's|localhost:5432|localhost:5433|g' .env && rm -f .env.bak
fi

# 4b. If using MySQL, wait for MySQL (opentel DB created by MYSQL_DATABASE)
if grep -q '^DATABASE_URL=.*mysql' .env 2>/dev/null; then
  echo "==> Waiting for MySQL..."
  MAX_ATTEMPTS=30
  ATTEMPT=0
  until docker compose -f infra/docker-compose.yml exec -T mysql mysqladmin ping -h localhost -u root -proot 2>/dev/null; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
      echo "ERROR: MySQL did not become ready in time"
      exit 1
    fi
    echo "  Waiting for MySQL... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
  done
  echo "  MySQL is ready."
fi

# 5. Run migrations (use DATABASE_URL from .env or default to Postgres)
echo "==> Running database migrations..."
[ -f .env ] && set -a && . ./.env && set +a
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/opentel}"
pnpm db:migrate
echo ""

echo "==> Autoconfigure complete."
echo ""
echo "Next steps:"
echo "  pnpm dev          # Start API + signaling"
echo "  pnpm dev:wizard   # Start config wizard (port 3003)"
echo "  infra/dev.html    # Open in browser for first-call test"

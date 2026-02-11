#!/usr/bin/env bash
# Free OpenTel app ports (3000, 3001, 3003, 3004) so pnpm dev can bind.
# Use after EADDRINUSE from a previous run.

set -e
PORTS="${OPENTEL_PORTS:-3000 3001 3003 3004}"
freed=0
for p in $PORTS; do
  # macOS: lsof -ti:PORT; Linux: same. PIDs may be multiple lines.
  pids=$(lsof -ti:"$p" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Killing process(es) on port $p: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    freed=$((freed + 1))
  fi
done
if [ "$freed" -eq 0 ]; then
  echo "No processes found on ports: $PORTS"
else
  echo "Freed $freed port(s). You can run pnpm dev now."
fi

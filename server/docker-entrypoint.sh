#!/bin/sh
set -e

echo "[entrypoint] Rybbit backend starting (PID $$)"

echo "[entrypoint] Waiting for PostgreSQL..."
attempt=0
until pg_isready -h "${POSTGRES_HOST:-postgres}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-frog}" -d "${POSTGRES_DB:-analytics}" -q; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 90 ]; then
    echo "[entrypoint] ERROR: PostgreSQL not ready after 90s"
    exit 1
  fi
  sleep 1
done
echo "[entrypoint] PostgreSQL is ready."

clickhouse_host="${CLICKHOUSE_HOST:-http://clickhouse:8123}"
clickhouse_ping="${clickhouse_host%/}/ping"
echo "[entrypoint] Waiting for ClickHouse at ${clickhouse_ping}..."
attempt=0
until node -e "fetch(process.argv[1]).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" "${clickhouse_ping}" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 90 ]; then
    echo "[entrypoint] ERROR: ClickHouse not ready after 180s — check clickhouse container logs"
    exit 1
  fi
  if [ $((attempt % 10)) -eq 0 ]; then
    echo "[entrypoint] Still waiting for ClickHouse (${attempt}/90)..."
  fi
  sleep 2
done
echo "[entrypoint] ClickHouse is ready."

echo "[entrypoint] Running database migrations..."
if ! npm run db:migrate; then
  echo "[entrypoint] WARN: database migrations failed — starting app anyway (tables may already exist)"
fi

echo "[entrypoint] Starting application: $*"
exec "$@"
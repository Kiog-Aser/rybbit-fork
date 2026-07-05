#!/bin/sh
set -e

# Wait for PostgreSQL to be ready (postgresql-client is already in the image)
echo "Waiting for PostgreSQL..."
until pg_isready -h "${POSTGRES_HOST:-postgres}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-frog}" -d "${POSTGRES_DB:-analytics}" -q; do
  sleep 1
done
echo "PostgreSQL is ready."

clickhouse_host="${CLICKHOUSE_HOST:-http://clickhouse:8123}"
clickhouse_ping="${clickhouse_host%/}/ping"
echo "Waiting for ClickHouse at ${clickhouse_ping}..."
until node -e "fetch(process.argv[1]).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" "${clickhouse_ping}" >/dev/null 2>&1; do
  sleep 2
done
echo "ClickHouse is ready."

# Run file-based migrations
echo "Running database migrations..."
npm run db:migrate

# Start the application
echo "Starting application..."
exec "$@"

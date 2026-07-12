#!/usr/bin/env bash
# Roll the production Docker Compose droplet to a published akash-<sha> image tag.
#
# Usage:
#   ./akash/deploy-droplet.sh cdc74d5
#   DEPLOY_HOST=root@165.22.124.190 ./akash/deploy-droplet.sh cdc74d5
#
# Requires SSH access to the host running /rybbit/docker-compose.yml

set -euo pipefail

SHA="${1:-}"
DEPLOY_HOST="${DEPLOY_HOST:-root@165.22.124.190}"
COMPOSE_DIR="${COMPOSE_DIR:-/rybbit}"
REGISTRY_OWNER="${REGISTRY_OWNER:-kiog-aser}"

if [[ -z "$SHA" || ! "$SHA" =~ ^[a-f0-9]{7}$ ]]; then
  echo "Usage: $0 <7-char-git-sha>   e.g. cdc74d5" >&2
  exit 1
fi

BACKEND_IMAGE="ghcr.io/${REGISTRY_OWNER}/rybbit-backend:akash-${SHA}"
CLIENT_IMAGE="ghcr.io/${REGISTRY_OWNER}/rybbit-client:akash-${SHA}"

echo "Deploying to $DEPLOY_HOST ($COMPOSE_DIR)"
echo "  backend: $BACKEND_IMAGE"
echo "  client:  $CLIENT_IMAGE"

ssh -o StrictHostKeyChecking=accept-new "$DEPLOY_HOST" bash -s <<EOF
set -euo pipefail
cd "$COMPOSE_DIR"
if [[ ! -f docker-compose.yml ]]; then
  echo "docker-compose.yml not found in $COMPOSE_DIR" >&2
  exit 1
fi
sed -i.bak -E 's|ghcr.io/${REGISTRY_OWNER}/rybbit-backend:akash-[a-f0-9]+|${BACKEND_IMAGE}|g' docker-compose.yml
sed -i.bak -E 's|ghcr.io/${REGISTRY_OWNER}/rybbit-client:akash-[a-f0-9]+|${CLIENT_IMAGE}|g' docker-compose.yml
docker compose pull backend client
docker compose up -d --no-deps backend client
echo "---"
docker compose ps backend client
EOF

echo "Deploy complete."

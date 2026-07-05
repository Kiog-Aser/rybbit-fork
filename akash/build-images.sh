#!/usr/bin/env bash
set -euo pipefail

# Build and optionally push fork images for Akash deploy.
# Usage:
#   REGISTRY=ghcr.io/you TAG=akash ./akash/build-images.sh
#   PUSH=1 REGISTRY=ghcr.io/you TAG=akash ./akash/build-images.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="${REGISTRY:-ghcr.io/your-user}"
TAG="${TAG:-akash}"
BASE_URL="${BASE_URL:-https://analytics.example.com}"

echo "Building backend → ${REGISTRY}/rybbit-backend:${TAG}"
docker build -t "${REGISTRY}/rybbit-backend:${TAG}" -f "${ROOT}/server/Dockerfile" "${ROOT}"

echo "Building client → ${REGISTRY}/rybbit-client:${TAG}"
docker build -t "${REGISTRY}/rybbit-client:${TAG}" -f "${ROOT}/client/Dockerfile" \
  --build-arg "NEXT_PUBLIC_BACKEND_URL=${BASE_URL}" \
  --build-arg "NEXT_PUBLIC_DISABLE_SIGNUP=true" \
  --build-arg "NEXT_PUBLIC_LITE_DASHBOARD=true" \
  --build-arg "NEXT_PUBLIC_DEPLOYMENT=akash" \
  --build-arg "NEXT_PUBLIC_REVENUE_ATTRIBUTION=true" \
  "${ROOT}"

if [[ "${PUSH:-}" == "1" ]]; then
  docker push "${REGISTRY}/rybbit-backend:${TAG}"
  docker push "${REGISTRY}/rybbit-client:${TAG}"
  echo "Pushed. Update akash/deploy.yaml image: lines."
else
  echo "Built locally. Set PUSH=1 to push to registry."
fi
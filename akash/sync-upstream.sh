#!/usr/bin/env bash
# Merge upstream Rybbit releases into this fork without dropping Akash/custom work.
#
# Usage:
#   ./akash/sync-upstream.sh v2.7.0
#   UPSTREAM_REMOTE=upstream ./akash/sync-upstream.sh v2.7.0
#
# After the script finishes (or stops on conflicts):
#   1. Review: git log --oneline -5 && git diff upstream/$(git describe --tags --abbrev=0)
#   2. Test: docker compose -f docker-compose.yml -f docker-compose.akash.yml build
#   3. Merge branch to master → Akash Images CI builds → deploy with ./akash/deploy-droplet.sh <sha>

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
UPSTREAM_REF="${1:-}"
OVERLAY_FILE="${OVERLAY_FILE:-$ROOT/akash/fork-overlay.paths}"

if [[ -z "$UPSTREAM_REF" ]]; then
  echo "Usage: $0 <upstream-tag-or-branch>   e.g. v2.7.0" >&2
  exit 1
fi

if ! git remote get-url "$UPSTREAM_REMOTE" &>/dev/null; then
  echo "Add upstream remote first:" >&2
  echo "  git remote add upstream https://github.com/rybbit-io/rybbit.git" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Commit or stash local changes before syncing upstream." >&2
  git status --short
  exit 1
fi

echo "Fetching $UPSTREAM_REMOTE..."
git fetch "$UPSTREAM_REMOTE" --tags

BRANCH="sync/${UPSTREAM_REF}-$(date +%Y%m%d)"
git checkout -b "$BRANCH"

echo "Merging $UPSTREAM_REMOTE/$UPSTREAM_REF into $BRANCH..."
set +e
git merge "$UPSTREAM_REMOTE/$UPSTREAM_REF" -m "Merge upstream $UPSTREAM_REF into fork"
MERGE_STATUS=$?
set -e

if [[ "$MERGE_STATUS" -ne 0 ]]; then
  echo "Merge conflicts — applying fork overlay (ours) for protected paths..."
  while IFS= read -r path || [[ -n "$path" ]]; do
    [[ -z "$path" || "$path" =~ ^# ]] && continue
    if git ls-files -u -- "$path" 2>/dev/null | grep -q .; then
      echo "  ours: $path"
      git checkout --ours -- "$path" 2>/dev/null || true
      git add -- "$path" 2>/dev/null || true
    fi
  done < "$OVERLAY_FILE"

  REMAINING="$(git diff --name-only --diff-filter=U || true)"
  if [[ -n "$REMAINING" ]]; then
    echo ""
    echo "Remaining conflicts (resolve manually, then: git add ... && git commit):" >&2
    echo "$REMAINING" >&2
    echo ""
    echo "Common fork touchpoints: server/src/index.ts, server/package.json, client/package.json" >&2
    exit 1
  fi

  git commit --no-edit
fi

# Bump client + server package.json to upstream tag version when merging a release tag
if [[ "$UPSTREAM_REF" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  VERSION="${UPSTREAM_REF#v}"
  node -e "
    const fs = require('fs');
    for (const pkg of ['client/package.json', 'server/package.json']) {
      const j = JSON.parse(fs.readFileSync(pkg, 'utf8'));
      j.version = '$VERSION';
      fs.writeFileSync(pkg, JSON.stringify(j, null, 2) + '\n');
    }
  "
  git add client/package.json server/package.json
  git diff --cached --quiet || git commit -m "Bump package version to $VERSION after upstream merge"
fi

echo ""
echo "Done. Branch: $BRANCH"
echo "Next: test locally, merge to master, push (CI builds akash-<sha>), then:"
echo "  ./akash/deploy-droplet.sh <7-char-sha>"

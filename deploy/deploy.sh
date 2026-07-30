#!/usr/bin/env bash
#
# Push the site to the server. Run from your machine, in the repo root:
#   ./deploy/deploy.sh user@your-server-ip
#
# Static files go to the webroot; the API service is restarted only if any
# server-side file actually changed.

set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "usage: ./deploy/deploy.sh user@host" >&2
  exit 1
fi

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_ROOT="/var/www/zentallio-website"

echo "→ syncing $REPO  →  $TARGET:$REMOTE_ROOT"

rsync -avz --delete \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'node_modules' \
  --exclude 'dev-server.py' \
  --exclude '*.md' \
  --rsync-path="sudo rsync" \
  "$REPO"/ "$TARGET:$REMOTE_ROOT/"

echo "→ fixing ownership"
ssh "$TARGET" "sudo chown -R www-data:www-data $REMOTE_ROOT"

echo "→ restarting API"
ssh "$TARGET" "sudo systemctl restart zentallio-api && sleep 1 && sudo systemctl is-active zentallio-api"

echo "→ health check"
ssh "$TARGET" "curl -fsS http://127.0.0.1:3001/health" && echo

echo "✓ deployed"

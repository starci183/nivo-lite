#!/usr/bin/env bash
# Deploy the NIVO engine stack to a VPS: rsync this engine/ folder, then `docker compose up -d --build` over SSH.
#   DEPLOY_HOST=deploy@203.0.113.10 ./deploy.sh
# Environment (nothing is hard-coded; no host is contacted unless you set DEPLOY_HOST):
#   DEPLOY_HOST       required  user@host of the VPS (key-based SSH, user in the docker group)
#   DEPLOY_PATH       optional  target folder on the VPS (default /opt/nivo-engine)
#   DEPLOY_SSH_PORT   optional  SSH port (default 22)
#   DEPLOY_SSH_OPTS   optional  extra ssh options, e.g. "-i ~/.ssh/nivo_vps"
#   DEPLOY_PUSH_ENV   optional  1 = also copy ./.env.prod (next to this script) to the VPS as deploy/.env, chmod 600.
#                               Default 0: the VPS keeps the .env you created there.
#   DRY_RUN           optional  1 = print every command, run none
set -euo pipefail

: "${DEPLOY_HOST:?set DEPLOY_HOST=user@host}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/nivo-engine}"
DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"
DEPLOY_SSH_OPTS="${DEPLOY_SSH_OPTS:-}"
DEPLOY_PUSH_ENV="${DEPLOY_PUSH_ENV:-0}"
DRY_RUN="${DRY_RUN:-0}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
engine_dir="$(cd "$here/.." && pwd)"
ssh_line="ssh -p $DEPLOY_SSH_PORT -o BatchMode=yes -o StrictHostKeyChecking=yes $DEPLOY_SSH_OPTS"

run() {
  if [ "$DRY_RUN" = "1" ]; then printf '[dry-run]'; printf ' %q' "$@"; printf '\n'; else "$@"; fi
}
# shellcheck disable=SC2086
remote() { run $ssh_line "$DEPLOY_HOST" "$1"; }

echo "==> checking the build locally (npm ci, typecheck, build)"
if [ "$DRY_RUN" = "1" ]; then
  echo "[dry-run] (cd $engine_dir && npm ci && npm run typecheck && npm run build)"
else
  (cd "$engine_dir" && npm ci --no-audit --no-fund && npm run typecheck && npm run build)
fi

echo "==> syncing $engine_dir to $DEPLOY_HOST:$DEPLOY_PATH"
remote "mkdir -p '$DEPLOY_PATH'"
# Source only: node_modules/dist are built on the VPS, local env files and the dev mocks never leave this machine.
# Excluded paths are also protected from --delete, so the .env that lives on the VPS survives every sync.
run rsync -az --delete \
  --include '.env.example' \
  --exclude node_modules --exclude dist --exclude dev --exclude '.env' --exclude '.env.*' --exclude '*.log' \
  -e "$ssh_line" \
  "$engine_dir/" "$DEPLOY_HOST:$DEPLOY_PATH/"

if [ "$DEPLOY_PUSH_ENV" = "1" ]; then
  [ -f "$here/.env.prod" ] || { echo "DEPLOY_PUSH_ENV=1 but $here/.env.prod does not exist" >&2; exit 1; }
  echo "==> copying .env.prod to the VPS as deploy/.env (chmod 600)"
  run rsync -az --chmod=F600 -e "$ssh_line" "$here/.env.prod" "$DEPLOY_HOST:$DEPLOY_PATH/deploy/.env"
fi

echo "==> starting the stack on the VPS"
remote "cd '$DEPLOY_PATH/deploy' && test -f .env || { echo 'deploy/.env is missing on the VPS: copy deploy/.env.example to deploy/.env and fill it in' >&2; exit 1; }"
remote "cd '$DEPLOY_PATH/deploy' && docker compose --env-file .env config -q"
remote "cd '$DEPLOY_PATH/deploy' && docker compose --env-file .env up -d --build --remove-orphans"
remote "cd '$DEPLOY_PATH/deploy' && docker compose --env-file .env ps"

echo "==> done. Check: https://engine.<your domain>/healthz  (and the status card in Settings > Processor)"

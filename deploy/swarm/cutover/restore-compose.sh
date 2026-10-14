#!/usr/bin/env bash
# Rollback of the cutover window: runs ON the VPS (`ssh vps bash -s -- --execute < restore-compose.sh`). It removes the Swarm stack and starts the
# three compose projects of the previous model again from the folders retire-compose.sh left in place (same volumes, same sealed-secret files,
# same image tags still on the host). Use it when the first Swarm release fails or the owner calls the cutover off.
# After a LATER cutover attempt is called off the same way, or when the folders are gone, run the old workflows from the rollback tag instead
# (node $C/08-rollback.mjs --execute, be/docs/runbooks/cutover.md, Rollback): they rebuild and redeploy the compose model.
# Dry run unless `--execute`.
set -euo pipefail
exec_mode=0
[ "${1:-}" = "--execute" ] && exec_mode=1
run() { if [ "$exec_mode" = 1 ]; then echo "+ $*"; "$@"; else echo "[dry run] $*"; fi; }

if docker stack ls --format '{{.Name}}' 2>/dev/null | grep -qx "${NIVO_STACK:-nivo}"; then
  run docker stack rm "${NIVO_STACK:-nivo}"
  if [ "$exec_mode" = 1 ]; then
    for _ in $(seq 1 60); do [ -z "$(docker ps -q --filter "label=com.docker.stack.namespace=${NIVO_STACK:-nivo}")" ] && break; sleep 2; done
    # the edge network of the stack must be gone before the compose edge creates its own ports
    sleep 5
  fi
fi

for need in "$HOME/nivo-edge/docker-compose.yml" "$HOME/nivo-engine/deploy/docker-compose.yml" "$HOME/nivo-web/docker-compose.yml"; do
  [ -f "$need" ] || { echo "restore-compose: $need is missing; use the old workflows from the rollback tag" >&2; exit 1; }
done
docker network inspect nivo-edge >/dev/null 2>&1 || run docker network create nivo-edge
run bash -c "cd '$HOME/nivo-engine/deploy' && docker compose --env-file .env up -d"
run bash -c "cd '$HOME/nivo-web' && WEB_TAG=\"\$(cat .tag)\" docker compose up -d"
run bash -c "cd '$HOME/nivo-edge' && docker compose up -d"
if [ -x "$HOME/nivo-engine/deploy/watchdog.sh" ] && [ "$exec_mode" = 1 ]; then
  { crontab -l 2>/dev/null | grep -v "nivo-engine-watchdog" || true; echo "* * * * * $HOME/nivo-engine/deploy/watchdog.sh # nivo-engine-watchdog"; } | crontab -
fi
echo "restore-compose: done$([ "$exec_mode" = 1 ] || echo ' (dry run)')"

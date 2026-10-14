#!/usr/bin/env bash
# Cutover window, step "stop the compose model": runs ON the VPS (the workflow pipes it over ssh: `ssh vps bash -s -- --execute < retire-compose.sh`).
# It stops the three compose projects of the previous model and removes the host crontab line of the old watchdog. It removes containers and
# networks of those projects ONLY: no volume (-v is never passed), no image, no folder. The release folders ~/nivo-engine, ~/nivo-edge and
# ~/nivo-web stay as they are, which is what restore-compose.sh needs to bring the old model back.
# Order: web, engine (api + openclaw + n8n), edge last, so the public door answers until the rest is down. The Swarm stack must be deployed right
# after (the images were pulled and the secrets provisioned BEFORE this step, so the window is the start time of the tasks, about a minute or two).
# Dry run unless `--execute` AND NIVO_RETIRE_COMPOSE_APPROVED=1 (the owner's go for the cutover window).
set -euo pipefail
exec_mode=0
[ "${1:-}" = "--execute" ] && exec_mode=1
run() { if [ "$exec_mode" = 1 ]; then echo "+ $*"; "$@"; else echo "[dry run] $*"; fi; }

if [ "$exec_mode" = 1 ] && [ "${NIVO_RETIRE_COMPOSE_APPROVED:-}" != "1" ]; then
  echo "retire-compose: refusing; set NIVO_RETIRE_COMPOSE_APPROVED=1 after the owner approved the cutover window" >&2; exit 3
fi
state="$(docker info --format '{{.Swarm.LocalNodeState}} {{.Swarm.ControlAvailable}}')"
[ "$state" = "active true" ] || { echo "retire-compose: this node is not a swarm manager ($state); initialize the swarm first (vps.sh prepare --init-swarm)" >&2; exit 1; }

# the old watchdog (host crontab) must not outlive the model it watched
if crontab -l 2>/dev/null | grep -q "nivo-engine-watchdog"; then
  echo "removing the nivo-engine-watchdog crontab line"
  if [ "$exec_mode" = 1 ]; then crontab -l | grep -v "nivo-engine-watchdog" | crontab - || true; fi
fi

for project in "nivo-web:$HOME/nivo-web" "nivo-engine:$HOME/nivo-engine/deploy" "nivo-edge:$HOME/nivo-edge"; do
  name="${project%%:*}"; dir="${project#*:}"
  if [ -d "$dir" ] && [ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$name")" ]; then
    # `down` without -v: containers and the project network go, the named volumes (openclaw-data, n8n-db, n8n-data, acme, ...) stay.
    if [ "$name" = "nivo-engine" ]; then run bash -c "cd '$dir' && docker compose --env-file .env down --timeout 45"
    elif [ "$name" = "nivo-web" ]; then run bash -c "cd '$dir' && WEB_TAG=\"\$(cat .tag 2>/dev/null || echo none)\" docker compose down --timeout 30"
    else run bash -c "cd '$dir' && docker compose down --timeout 30"; fi
  else
    echo "$name: no compose containers (already retired, or never ran here)"
  fi
done
echo "retire-compose: done$([ "$exec_mode" = 1 ] || echo ' (dry run)'); deploy the stack now"

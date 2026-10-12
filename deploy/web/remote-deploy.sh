#!/usr/bin/env bash
# Runs ON the VPS (piped over ssh by .github/workflows/web-deploy.yml): starts nivo-web:$1, health-checks it, rolls back to the previous tag if unhealthy.
# Expects ~/nivo-web/{docker-compose.yml,.env} already uploaded and the image already loaded.
set -euo pipefail
NEW="${1:?usage: remote-deploy.sh <tag>}"
cd ~/nivo-web
docker network inspect nivo-edge >/dev/null 2>&1 || docker network create nivo-edge >/dev/null
export WEB_TAG="${1}"
PREV=""; [ -f .tag ] && PREV="$(cat .tag)"
cname() { docker compose ps -q web 2>/dev/null | head -1; }
wait_healthy() {
  local state=missing
  for _ in $(seq 1 36); do
    state="$(docker inspect -f '{{.State.Health.Status}}' "$(cname)" 2>/dev/null || echo missing)"
    [ "$state" = healthy ] && return 0
    sleep 5
  done
  echo "not healthy (last: $state)"; return 1
}
echo "deploying nivo-web:$NEW (previous: ${PREV:-none})"
WEB_TAG="$NEW" docker compose up -d --remove-orphans
if wait_healthy; then
  echo "$NEW" > .tag
  echo "$PREV" > .tag.prev
  # keep the current and the previous image only
  docker image ls nivo-web --format '{{.Tag}}' | grep -vxF -e "$NEW" -e "${PREV:-__none__}" -e latest | xargs -r -I{} docker rmi nivo-web:{} >/dev/null 2>&1 || true
  docker compose ps --format 'table {{.Service}}\t{{.Status}}'
  exit 0
fi
docker compose logs --tail 80 web || true
if [ -n "$PREV" ] && docker image inspect "nivo-web:$PREV" >/dev/null 2>&1; then
  echo "rolling back to nivo-web:$PREV"
  WEB_TAG="$PREV" docker compose up -d --remove-orphans
  wait_healthy && echo "rollback healthy" || echo "ROLLBACK ALSO UNHEALTHY"
else
  echo "no previous image to roll back to"
fi
exit 1

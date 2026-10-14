#!/usr/bin/env bash
# Operator commands of the production Swarm stack: the seven runbook commands of .starcistacks/production/README.md that are not the deploy
# workflow. Run on the VPS manager, or anywhere with DOCKER_HOST=ssh://<user>@<host> (host key pinned in ~/.ssh/known_hosts first).
#
#   vps.sh prepare [--init-swarm]  read-only checks (OS, Docker, ports, disk, Swarm state, volumes, networks); creates the external volumes a fresh
#                                  host lacks. --init-swarm runs `docker swarm init` ONLY with NIVO_SWARM_INIT_APPROVED=1 (the owner's approval)
#   vps.sh doctor                  the same checks plus services, secrets, configs and the release pointers; changes nothing
#   vps.sh status                  stack services, tasks (with errors) and update state
#   vps.sh logs <service> [args]   docker service logs (api, web, ingress, openclaw, n8n)
#   vps.sh down                    docker stack rm nivo: the stack goes, volumes, secrets and configs stay
#   vps.sh tunnel n8n|openclaw     a loopback-only socat container that joins the private network, for the editor / Control UI over an SSH tunnel
#   vps.sh backup                  see deploy/swarm/backup.sh
set -euo pipefail
STACK="${NIVO_STACK:-nivo}"
VOLUMES=(nivo-engine_openclaw-data nivo-engine_video-cache nivo-engine_n8n-data nivo-edge_acme)

ok() { printf 'ok    %s\n' "$*"; }
bad() { printf 'FAIL  %s\n' "$*"; failed=1; }
failed=0

swarm_state() { docker info --format '{{.Swarm.LocalNodeState}} {{.Swarm.ControlAvailable}}' 2>/dev/null || echo "unreachable false"; }

checks() {
  local state ctl
  read -r state ctl <<<"$(swarm_state)"
  [ "$state" != unreachable ] && ok "docker daemon reachable ($(docker version --format '{{.Server.Version}}'))" || { bad "docker daemon not reachable"; return; }
  [ "$(docker info --format '{{.OSType}}/{{.Architecture}}')" = "linux/x86_64" ] && ok "linux/x86_64" || bad "unsupported platform $(docker info --format '{{.OSType}}/{{.Architecture}}')"
  [ "$state $ctl" = "active true" ] && ok "swarm active, this node is a manager" || bad "swarm is '$state' (manager: $ctl): the owner approves 'vps.sh prepare --init-swarm' once"
  [ "$(docker node ls -q 2>/dev/null | wc -l)" -le 1 ] && ok "single-manager swarm" || ok "swarm has $(docker node ls -q | wc -l) nodes: review quorum and placement before relying on it"
  for v in "${VOLUMES[@]}"; do docker volume inspect "$v" >/dev/null 2>&1 && ok "volume $v" || bad "volume $v missing (prepare creates it)"; done
  if command -v df >/dev/null 2>&1; then
    target=/var/lib/docker; [ -d "$target" ] || target=/
    avail_gb=$(df -Pk "$target" 2>/dev/null | awk 'NR==2{print int($4/1048576)}')
    [ "${avail_gb:-0}" -ge 10 ] && ok "disk: ${avail_gb} GB free under $target" || bad "disk: only ${avail_gb:-?} GB free under $target"
  fi
}

cmd="${1:-}"; shift || true
case "$cmd" in
  prepare)
    if [ "${1:-}" = "--init-swarm" ]; then
      [ "${NIVO_SWARM_INIT_APPROVED:-}" = "1" ] || { echo "vps.sh: docker swarm init is an owner-approved effect; set NIVO_SWARM_INIT_APPROVED=1 after the owner said yes" >&2; exit 3; }
      read -r state _ <<<"$(swarm_state)"
      if [ "$state" = "active" ]; then echo "swarm already active: nothing to initialize (never re-initialized)"; else
        docker swarm init ${NIVO_ADVERTISE_ADDR:+--advertise-addr "$NIVO_ADVERTISE_ADDR"}
        echo "SWARM INITIALIZED. Record the node id; back up /var/lib/docker/swarm (docker swarm unlock-key if autolock is enabled later)."
      fi
    fi
    for v in "${VOLUMES[@]}"; do docker volume inspect "$v" >/dev/null 2>&1 || { docker volume create "$v" >/dev/null && echo "created volume $v"; }; done
    checks; exit "$failed" ;;
  doctor)
    checks
    docker service ls --filter "label=com.docker.stack.namespace=$STACK" --format 'table {{.Name}}\t{{.Replicas}}\t{{.Image}}' 2>/dev/null || true
    echo "secrets: $(docker secret ls --filter label=nivo.managed=true -q 2>/dev/null | wc -l), configs: $(docker config ls --filter label=nivo.managed=true -q 2>/dev/null | wc -l)"
    exit "$failed" ;;
  status)
    docker stack services "$STACK" --format 'table {{.Name}}\t{{.Mode}}\t{{.Replicas}}\t{{.Image}}'
    docker stack ps "$STACK" --no-trunc --format 'table {{.Name}}\t{{.CurrentState}}\t{{.DesiredState}}\t{{.Error}}'
    for s in $(docker stack services "$STACK" --format '{{.Name}}'); do printf '%s update: ' "$s"; docker service inspect "$s" --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{else}}none{{end}}'; done ;;
  logs)
    svc="${1:?service: api web ingress openclaw n8n}"; shift
    exec docker service logs --tail 200 "$@" "${STACK}_${svc}" ;;
  down)
    docker stack rm "$STACK"
    echo "stack $STACK removed; volumes, secrets and configs are kept (docker stack deploy brings it back)" ;;
  tunnel)
    target="${1:?n8n or openclaw}"
    case "$target" in
      n8n) net="${STACK}_automation"; host=n8n; port=5678; local=5678 ;;
      openclaw) net="${STACK}_agents"; host=openclaw; port=18790; local=18789 ;;
      *) echo "tunnel: n8n or openclaw" >&2; exit 2 ;;
    esac
    echo "Listening on 127.0.0.1:$local of this host only. From your machine: ssh -L $local:127.0.0.1:$local <user>@<vps>   (Ctrl-C here ends it)"
    exec docker run --rm --name "nivo-tunnel-$target" --network "$net" -p "127.0.0.1:$local:$port" alpine/socat@sha256:fb3862c949af7c79996d0e514ee96128644d840835ed5368eeecb14a869de361 "TCP-LISTEN:$port,fork,reuseaddr" "TCP:$host:$port" ;;
  backup) exec "$(dirname "${BASH_SOURCE[0]}")/backup.sh" "$@" ;;
  *) sed -n '2,16p' "$0"; exit 2 ;;
esac

#!/usr/bin/env bash
# Keeps the engine reachable from OpenClaw. The engine runs in the OpenClaw container's network namespace (network_mode: service:openclaw), so
# whenever OpenClaw is recreated or restarted the engine is left in a dead namespace: it keeps running, but sees no network at all.
# Run every minute from the nivo user's crontab (the CI deploy step installs the line, idempotently). It recreates ONLY the engine service when:
#   - the engine cannot reach 127.0.0.1:18789 from inside its own container, or
#   - the engine container is not running / not healthy, or
#   - the openclaw container was (re)started after the engine started.
# Touches nothing else: not the edge, not n8n, not other compose projects. Log: ~/nivo-engine/watchdog.log (rotated at 512 KB, 3 files).
set -u
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ROOT="$HOME/nivo-engine"
DEPLOY="$ROOT/deploy"
LOG="$ROOT/watchdog.log"
ENGINE=nivo-engine-engine-1
OPENCLAW=nivo-engine-openclaw-1
COOLDOWN=90   # seconds between two recreations

[ -f "$DEPLOY/.env" ] || exit 0
[ -d "$HOME/nivo-engine.new" ] && exit 0   # a CI deploy is swapping the folder right now
exec 9>"$ROOT/.watchdog.lock" 2>/dev/null || exit 0
flock -n 9 || exit 0

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >> "$LOG"; }
if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -gt 524288 ]; then
  mv -f "$LOG.2" "$LOG.3" 2>/dev/null; mv -f "$LOG.1" "$LOG.2" 2>/dev/null; mv -f "$LOG" "$LOG.1"
fi

# Nothing to do until both containers exist (first deploy, or compose is mid-update).
docker inspect "$ENGINE" "$OPENCLAW" >/dev/null 2>&1 || exit 0

reason=""
state=$(docker inspect -f '{{.State.Status}}' "$ENGINE" 2>/dev/null || echo missing)
health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$ENGINE" 2>/dev/null || echo none)
oc_state=$(docker inspect -f '{{.State.Status}}' "$OPENCLAW" 2>/dev/null || echo missing)

if [ "$oc_state" != "running" ]; then
  exit 0   # OpenClaw itself is down: recreating the engine cannot help; the app's sweeper answers customers meanwhile
fi
if [ "$state" != "running" ]; then
  reason="engine container is $state"
elif [ "$health" = "unhealthy" ]; then
  reason="engine is unhealthy"
else
  engine_started=$(docker inspect -f '{{.State.StartedAt}}' "$ENGINE" 2>/dev/null)
  oc_started=$(docker inspect -f '{{.State.StartedAt}}' "$OPENCLAW" 2>/dev/null)
  es=$(date -d "$engine_started" +%s 2>/dev/null || echo 0)
  os=$(date -d "$oc_started" +%s 2>/dev/null || echo 0)
  if [ "$os" -gt "$es" ]; then
    reason="openclaw was (re)started after the engine"
  elif ! docker exec "$ENGINE" node -e "fetch('http://127.0.0.1:18789/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    # OpenClaw may still be starting: only act when it reports healthy itself.
    oc_health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$OPENCLAW" 2>/dev/null || echo none)
    [ "$oc_health" = "healthy" ] && reason="engine cannot reach 127.0.0.1:18789"
  fi
fi

[ -z "$reason" ] && exit 0

now=$(date +%s)
last=$(cat "$ROOT/.watchdog.last" 2>/dev/null || echo 0)
if [ $((now - last)) -lt "$COOLDOWN" ]; then
  exit 0
fi
echo "$now" > "$ROOT/.watchdog.last"
log "recreating engine: $reason"
if (cd "$DEPLOY" && docker compose --env-file .env up -d --force-recreate engine) >> "$LOG" 2>&1; then
  log "engine recreated"
else
  log "recreate FAILED"
fi

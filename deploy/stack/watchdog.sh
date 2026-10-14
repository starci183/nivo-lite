#!/usr/bin/env bash
# Keeps the api reachable from OpenClaw. The api runs in the OpenClaw container's network namespace (network_mode: service:openclaw), so
# whenever OpenClaw is recreated or restarted the api is left in a dead namespace: it keeps running, but sees no network at all.
# Run every minute from the nivo user's crontab (the CI deploy step installs the line, idempotently). It recreates ONLY the api service when:
#   - the api cannot reach 127.0.0.1:18789 from inside its own container, or
#   - the api container is not running / not healthy, or
#   - the openclaw container was (re)started after the api started.
# It also watches the background jobs (check_jobs below), from job_stats() in Postgres (asked through the api container's be jobs CLI on the app_be primary connection, nothing is printed but two numbers): jobs failed in the last 24 h (JOBS_FAILED_ALERT, default 20) and the oldest job still queued (JOBS_STALE_SECONDS, default 300).
# Those are ALERT lines in the same log, at most one per kind every 30 minutes; they never restart the api.
# Touches nothing else: not the edge, not n8n, not other compose projects. Log: ~/nivo-engine/watchdog.log (rotated at 512 KB, 3 files).
set -u
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ROOT="$HOME/nivo-engine"
DEPLOY="$ROOT/deploy"
LOG="$ROOT/watchdog.log"
API=nivo-engine-api-1
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

env_val() { grep -m1 "^$1=" "$DEPLOY/.env" 2>/dev/null | cut -d= -f2- | tr -d "\"'\r"; }
FAILED_MAX=$(env_val JOBS_FAILED_ALERT); FAILED_MAX=${FAILED_MAX:-20}
STALE_MAX=$(env_val JOBS_STALE_SECONDS); STALE_MAX=${STALE_MAX:-300}
ALERT_EVERY=1800

# alert <kind> <message>: one ALERT line per kind every ALERT_EVERY seconds (the log is the alert channel today; ship it wherever you page from).
alert() {
  local f="$ROOT/.watchdog.alert.$1" now last
  now=$(date +%s); last=$(cat "$f" 2>/dev/null || echo 0)
  [ $((now - last)) -lt "$ALERT_EVERY" ] && return 0
  echo "$now" > "$f"; log "ALERT $1: $2"
}

check_jobs() {
  # "<failed24h> <oldestQueuedAgeSeconds>" from job_stats(), or "-1 -1" when the api or the database does not answer (the recreate logic below handles the api).
  local out failed age
  out=$(docker exec "$API" node be/dist/apps/cli/src/main.js jobs watchdog 2>/dev/null | tr -d '\r')
  read -r failed age <<<"${out:--1 -1}"
  [ "${failed:--1}" -gt "$FAILED_MAX" ] 2>/dev/null && alert failed-jobs "$failed jobs failed in 24 h (limit $FAILED_MAX): be/docs/runbooks/jobs-operations.md, './jobs.sh failed'"
  [ "${age:--1}" -gt "$STALE_MAX" ] 2>/dev/null && alert jobs-stale "a job has waited ${age}s (limit ${STALE_MAX}s): is the api consuming? './jobs.sh open'"
  return 0
}

# Nothing to do until both containers exist (first deploy, or compose is mid-update).
docker inspect "$API" "$OPENCLAW" >/dev/null 2>&1 || exit 0
check_jobs

reason=""
state=$(docker inspect -f '{{.State.Status}}' "$API" 2>/dev/null || echo missing)
health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$API" 2>/dev/null || echo none)
oc_state=$(docker inspect -f '{{.State.Status}}' "$OPENCLAW" 2>/dev/null || echo missing)

if [ "$oc_state" != "running" ]; then
  exit 0   # OpenClaw itself is down: recreating the api cannot help; the app's sweeper answers customers meanwhile
fi
if [ "$state" != "running" ]; then
  reason="api container is $state"
elif [ "$health" = "unhealthy" ]; then
  reason="api is unhealthy"
else
  api_started=$(docker inspect -f '{{.State.StartedAt}}' "$API" 2>/dev/null)
  oc_started=$(docker inspect -f '{{.State.StartedAt}}' "$OPENCLAW" 2>/dev/null)
  es=$(date -d "$api_started" +%s 2>/dev/null || echo 0)
  os=$(date -d "$oc_started" +%s 2>/dev/null || echo 0)
  if [ "$os" -gt "$es" ]; then
    reason="openclaw was (re)started after the api"
  elif ! docker exec "$API" node -e "fetch('http://127.0.0.1:18789/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    # OpenClaw may still be starting: only act when it reports healthy itself.
    oc_health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$OPENCLAW" 2>/dev/null || echo none)
    [ "$oc_health" = "healthy" ] && reason="api cannot reach 127.0.0.1:18789"
  fi
fi

[ -z "$reason" ] && exit 0

now=$(date +%s)
last=$(cat "$ROOT/.watchdog.last" 2>/dev/null || echo 0)
if [ $((now - last)) -lt "$COOLDOWN" ]; then
  exit 0
fi
echo "$now" > "$ROOT/.watchdog.last"
log "recreating api: $reason"
if (cd "$DEPLOY" && docker compose --env-file .env up -d --force-recreate api) >> "$LOG" 2>&1; then
  log "api recreated"
else
  log "recreate FAILED"
fi

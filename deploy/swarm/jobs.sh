#!/usr/bin/env bash
# Operator helper for the background jobs on Supabase Queues (pgmq). It resolves the running api task of the Swarm stack and runs the be jobs CLI
# in it on the app_be primary connection; nothing is printed but results. Run it on the VPS manager, or anywhere with DOCKER_HOST=ssh://<vps>.
#   jobs.sh stats                  per queue depth and oldest age, jobs running, failed in 24 h, oldest queued outbox row (job_stats)
#   jobs.sh failed [N]             the last N (default 20) failed jobs: outbox id, name, attempts, last_error (never the payload)
#   jobs.sh open [N]               the oldest N (default 20) queued/running jobs
#   jobs.sh retry <outbox-id>      send one failed job again (job_requeue: new message, attempts reset)
#   jobs.sh retry-failed [hours]   send again every job that failed in the last <hours> (default 24)
#   jobs.sh watchdog               "<failed24h> <oldestQueuedAgeSeconds>" (what the api alert monitor reads)
# Jobs are idempotent and the outbox row is the record of every job: retry is always safe (be/docs/runbooks/jobs-operations.md).
# Alerts are raised by the api itself (job-ops alert monitor: app_errors row and a log event); there is no host cron.
set -euo pipefail
cmd="${1:-stats}"
case "$cmd" in
  stats|failed|open|retry|retry-failed|watchdog) ;;
  *) sed -n '2,11p' "$0"; exit 2 ;;
esac
task="$(docker ps -q --filter "label=com.docker.swarm.service.name=${NIVO_STACK:-nivo}_api" --filter status=running | head -n 1)"
[ -n "$task" ] || { echo "jobs.sh: no running api task of stack ${NIVO_STACK:-nivo} on this daemon" >&2; exit 1; }
shift || true
exec docker exec "$task" node be/dist/apps/cli/src/main.js jobs "$cmd" "$@"

#!/usr/bin/env bash
# Operator helper for the background jobs on Supabase Queues (pgmq), run ON THE VPS from the stack folder (~/nivo-engine/deploy). Everything
# goes through the api container's be jobs CLI on the app_be primary database connection; nothing is printed but results.
#   ./jobs.sh stats                  per queue depth and oldest age, jobs running, failed in 24 h, oldest queued outbox row (job_stats)
#   ./jobs.sh failed [N]             the last N (default 20) failed jobs: outbox id, name, attempts, last_error (never the payload)
#   ./jobs.sh open [N]               the oldest N (default 20) queued/running jobs
#   ./jobs.sh retry <outbox-id>      send one failed job again (job_requeue: new message, attempts reset)
#   ./jobs.sh retry-failed [hours]   send again every job that failed in the last <hours> (default 24)
# Jobs are idempotent and the outbox row is the record of every job: retry is always safe (be/docs/runbooks/jobs-operations.md).
# The same queries run in the Supabase SQL editor: select * from job_stats(); select * from pgmq.metrics('knowledge'); select * from pgmq.a_knowledge;
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
api_node() { docker compose --env-file .env exec -T api node be/dist/apps/cli/src/main.js jobs "$@"; }

cmd="${1:-stats}"
case "$cmd" in
  stats|failed|open|retry|retry-failed) ;;
  *) sed -n '2,10p' "$0"; exit 2 ;;
esac
if [ "$#" -gt 1 ]; then
  api_node "$cmd" "$2"
else
  api_node "$cmd"
fi

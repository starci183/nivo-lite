#!/usr/bin/env bash
# Operator helper for the BullMQ job system, run ON THE VPS from engine/deploy (~/nivo-engine/deploy). Reads go through redis-cli in the
# redis container; retry/drain use the BullMQ client already inside the engine image (REDIS_URL comes from the engine's own env).
#   ./jobs.sh queues                 queues found in Redis with their counts
#   ./jobs.sh failed [queue] [N]     the last N (default 20) failed jobs: id, name, attempts, failedReason (never the payload)
#   ./jobs.sh retry <queue>          move every failed job of the queue back to waiting
#   ./jobs.sh drain <queue>          delete the waiting and delayed jobs of the queue (active ones finish; failed ones stay)
#   ./jobs.sh clean-failed <queue>   delete the failed jobs of the queue
#   ./jobs.sh ping                   redis PING + persistence settings
# Jobs are idempotent and the Postgres outbox is the source of truth: retry and drain are always safe (docs/OPERATIONS-JOBS.md).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
ENV=(--env-file .env)
rc() { docker compose "${ENV[@]}" exec -T redis redis-cli "$@" | tr -d '\r'; }
engine_node() { docker compose "${ENV[@]}" exec -T engine node -e "$1" "${@:2}"; }
queues() { rc --scan --pattern 'bull:*:meta' | sed -E 's/^bull:(.*):meta$/\1/' | sort -u; }

cmd="${1:-queues}"; q="${2:-}"
case "$cmd" in
  ping) rc ping; rc config get appendonly; rc config get save ;;
  queues)
    for name in $(queues); do
      printf '%-32s waiting=%s active=%s delayed=%s failed=%s completed=%s\n' "$name" \
        "$(rc llen "bull:$name:wait")" "$(rc llen "bull:$name:active")" "$(rc zcard "bull:$name:delayed")" "$(rc zcard "bull:$name:failed")" "$(rc zcard "bull:$name:completed")"
    done ;;
  failed)
    n="${3:-20}"
    names="${q:-$(queues)}"
    for name in $names; do
      echo "== $name (newest $n failed)"
      for id in $(rc zrevrange "bull:$name:failed" 0 "$((n - 1))"); do
        rc hmget "bull:$name:$id" name attemptsMade failedReason | paste -sd'|' | sed "s/^/job $id | /"
      done
    done ;;
  retry|drain|clean-failed)
    [ -n "$q" ] || { echo "usage: $0 $cmd <queue>   (queues: $(queues | paste -sd' '))" >&2; exit 2; }
    engine_node '
      const { Queue } = require("bullmq"); const IORedis = require("ioredis");
      const [op, name] = process.argv.slice(1);
      const conn = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
      const queue = new Queue(name, { connection: conn });
      (async () => {
        if (op === "retry") await queue.retryJobs({ state: "failed" });
        else if (op === "drain") await queue.drain(true);
        else await queue.clean(0, 100000, "failed");
        console.log(op + " " + name + " done", JSON.stringify(await queue.getJobCounts()));
        await queue.close(); conn.disconnect();
      })().catch((e) => { console.error(e.message); process.exit(1); });' "$cmd" "$q" ;;
  *) sed -n '2,12p' "$0"; exit 2 ;;
esac

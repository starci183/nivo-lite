#!/usr/bin/env bash
# Operator helper for the background jobs on Supabase Queues (pgmq), run ON THE VPS from the stack folder (~/nivo-engine/deploy). Everything
# goes through the api container's own Supabase client (SUPABASE_URL + service role from its env; nothing is printed but results).
#   ./jobs.sh stats                  per queue depth and oldest age, jobs running, failed in 24 h, oldest queued outbox row (job_stats)
#   ./jobs.sh failed [N]             the last N (default 20) failed jobs: outbox id, name, attempts, last_error (never the payload)
#   ./jobs.sh open [N]               the oldest N (default 20) queued/running jobs
#   ./jobs.sh retry <outbox-id>      send one failed job again (job_requeue: new message, attempts reset)
#   ./jobs.sh retry-failed [hours]   send again every job that failed in the last <hours> (default 24)
# Jobs are idempotent and the outbox row is the record of every job: retry is always safe (be/docs/runbooks/jobs-operations.md).
# The same queries run in the Supabase SQL editor: select * from job_stats(); select * from pgmq.metrics('knowledge'); select * from pgmq.a_knowledge;
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
api_node() { docker compose --env-file .env exec -T api node -e "$1" "${@:2}"; }

cmd="${1:-stats}"
case "$cmd" in
  stats|failed|open|retry|retry-failed) ;;
  *) sed -n '2,10p' "$0"; exit 2 ;;
esac
api_node '
  const { createClient } = require("@supabase/supabase-js");
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const [op, arg] = process.argv.slice(1);
  const die = (e) => { console.error(e.message || e); process.exit(1); };
  const rows = (r) => { if (r.error) die(r.error); for (const x of r.data) console.log(Object.values(x).map((v) => v ?? "").join(" | ")); };
  (async () => {
    if (op === "stats") { const r = await db.rpc("job_stats"); if (r.error) die(r.error); console.log(JSON.stringify(r.data, null, 2)); }
    else if (op === "failed") rows(await db.from("job_outbox").select("id, name, attempts, finished_at, last_error").eq("state", "failed").order("finished_at", { ascending: false }).limit(Number(arg) || 20));
    else if (op === "open") rows(await db.from("job_outbox").select("id, name, state, attempts, created_at, last_error").in("state", ["queued", "running"]).order("created_at").limit(Number(arg) || 20));
    else if (op === "retry") { if (!arg) die("usage: jobs.sh retry <outbox-id>"); const r = await db.rpc("job_requeue", { p_outbox: arg }); if (r.error) die(r.error); console.log(r.data === null ? "not a failed job" : "requeued as message " + r.data); }
    else {
      const since = new Date(Date.now() - (Number(arg) || 24) * 3600e3).toISOString();
      const f = await db.from("job_outbox").select("id").eq("state", "failed").gte("finished_at", since);
      if (f.error) die(f.error);
      let n = 0; for (const { id } of f.data) { const r = await db.rpc("job_requeue", { p_outbox: id }); if (!r.error && r.data !== null) n++; }
      console.log("requeued " + n + " of " + f.data.length);
    }
  })().catch(die);' "$cmd" "${2:-}"

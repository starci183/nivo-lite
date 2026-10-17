-- Retires the schema of the old engine. Nothing in the back end or the front end reads it: the api runs its jobs on pgmq and its ticks are the cron
-- jobs of 20261026000300_job-ticks.sql. Idempotent: on a database created from the baseline and on a database that already ran the earlier
-- drop-engine-schema migration, every statement checks for existence first.
--
-- The vault secret `engine_sweep_secret` that authorised the old pg_cron -> /api/engine/sweep call is not touched here (a migration never writes
-- to the vault): a database that still holds it has it removed by the operator, in the Supabase dashboard (Vault).

-- 1. pg_cron: nothing to unschedule here. The legacy engine jobs (engine-sweep, engine-openclaw-agent-sync, engine-connection-health, zalo-refresh,
--    nivo-automation-tick, nivo-content-tick, nivo-n8n-pipelines) were unscheduled by name in the archived migrations production already ran; the operator checks
--    that `select jobname from cron.job` lists only jobs this repository declares (see be/docs/runbooks/cutover.md).

-- 2. The engine functions and the pg_net refresh tick (the engine job functions return rows of engine_jobs, so they go first).
DROP FUNCTION IF EXISTS public.engine_claim_jobs(text, text[], integer, integer);
DROP FUNCTION IF EXISTS public.engine_complete_job(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.engine_enqueue(uuid, text, jsonb, text, timestamp with time zone, integer);
DROP FUNCTION IF EXISTS public.engine_enqueue_agent_sync(uuid, boolean);
DROP FUNCTION IF EXISTS public.engine_enqueue_workspace_sync(uuid);
DROP FUNCTION IF EXISTS public.engine_fail_job(uuid, text, text, integer, boolean);
DROP FUNCTION IF EXISTS public.engine_heartbeat_job(uuid, text, integer);
DROP FUNCTION IF EXISTS public.engine_mark_connection_health(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.engine_release_job(uuid, text);
DROP FUNCTION IF EXISTS public.engine_schedule_agent_sync();
DROP FUNCTION IF EXISTS public.engine_schedule_connection_health();
DROP FUNCTION IF EXISTS public.engine_status();
DROP FUNCTION IF EXISTS public.engine_sweep_authorized(text);
DROP FUNCTION IF EXISTS public.engine_sweep_claim();
DROP FUNCTION IF EXISTS public.engine_worker_heartbeat(text, text, text[], jsonb);
DROP FUNCTION IF EXISTS public.zalo_refresh_tick();

-- 3. The engine tables and the cron target list (the HTTP endpoints and secret the old pg_net ticks used).
DROP TABLE IF EXISTS public.engine_jobs;
DROP TABLE IF EXISTS public.engine_workers;
DROP TABLE IF EXISTS public.cron_targets;

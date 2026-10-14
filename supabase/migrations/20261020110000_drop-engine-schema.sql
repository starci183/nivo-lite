-- Retires the schema of the old engine. Nothing in the back end or the front end reads it: the api schedulers (modules/queues/*) publish
-- the ticks through pgmq and the jobs run on pgmq. Idempotent: on a database created from the baseline and on a database
-- that still carries the legacy objects, every statement checks for existence first.

-- 1. pg_cron: unschedule the legacy jobs that call the engine over HTTP (pg_net) or the engine functions. The jobs the api creates itself
--    at boot (the pgmq ticks of modules/queues/*, upserted by id with cron.schedule) and the four jobs of the baseline
--    (ai-generations-prune, hiring-apply-hits-prune, hiring-tick, video-renders-reap) do not match and are kept.
DO $$
DECLARE
    legacy record;
BEGIN
    IF to_regclass('cron.job') IS NULL THEN
        RETURN;
    END IF;
    FOR legacy IN
        SELECT jobname
        FROM cron.job
        WHERE jobname IS NOT NULL
          AND (
              command ~* 'net\.http_(post|get)'
              OR command ~* 'engine_(jobs|workers|claim|complete|enqueue|fail|heartbeat|release|status|sweep|mark|schedule|worker)'
              OR command ~* 'zalo_refresh_tick|cron_targets|/api/engine'
          )
    LOOP
        PERFORM cron.unschedule(legacy.jobname);
    END LOOP;
END
$$;

-- 2. The engine functions and the pg_net refresh tick (the engine job functions return rows of engine_jobs, so they go first).
DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure AS signature
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND (p.proname LIKE 'engine\_%' OR p.proname = 'zalo_refresh_tick')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %s', fn.signature);
    END LOOP;
END
$$;

-- 3. The engine tables and the cron target list (the HTTP endpoints and secret the old pg_net ticks used).
DROP TABLE IF EXISTS public.engine_jobs;
DROP TABLE IF EXISTS public.engine_workers;
DROP TABLE IF EXISTS public.cron_targets;

-- 4. The vault secret that authorised the pg_cron -> /api/engine/sweep call.
DO $$
BEGIN
    IF to_regclass('vault.secrets') IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE name = 'engine_sweep_secret';
    END IF;
END
$$;

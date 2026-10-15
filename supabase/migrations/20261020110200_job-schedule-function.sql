-- The queue schedulers of the be (automation tick, shifts tick, agents sync, ...) register their pg_cron jobs at boot. The least-privilege
-- role app_be has no privilege on the `cron` schema (on Supabase only postgres can grant there), so the be asks this definer function, like
-- job_enqueue() and job_stats(): it is owned by the migration role, pins its search_path, accepts only a queue name and a message body and
-- builds the one statement a scheduled job may run (a pgmq send), so the role cannot schedule arbitrary SQL.

CREATE OR REPLACE FUNCTION public.job_schedule(p_name text, p_schedule text, p_queue text, p_message text)
RETURNS bigint
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select cron.schedule(p_name, p_schedule, format('SELECT pgmq.send(%L, %L::jsonb)', p_queue, p_message))
$$;

REVOKE EXECUTE ON FUNCTION public.job_schedule(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_schedule(text, text, text, text) TO app_be;

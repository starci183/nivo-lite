-- The lite back end (role app_be) runs the job queue through the security-definer job_* functions of 20261012102300_pgmq-transport.sql:
-- job_enqueue inside the caller's transaction, job_read / job_touch / job_ack / job_fail / job_archive from the workers. They were callable
-- by service_role only (the old engine); the back end connects as app_be, so it gets execute on exactly these and on nothing else in pgmq
-- beyond what 20261012102500_be-platform.sql granted. The tables behind them (job_outbox, job_slots) stay closed to app_be: only the functions touch them.
grant execute on function public.job_enqueue(uuid, text, text, jsonb, text) to app_be;
grant execute on function public.job_read(text, int, int, int) to app_be;
grant execute on function public.job_touch(text, bigint, int) to app_be;
grant execute on function public.job_ack(text, bigint) to app_be;
grant execute on function public.job_fail(text, bigint, int, text) to app_be;
grant execute on function public.job_archive(text, bigint, text) to app_be;
grant execute on function public.job_requeue(uuid) to app_be;
grant execute on function public.job_stats() to app_be;

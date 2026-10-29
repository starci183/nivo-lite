-- Local proof of public.system_history_sweep: run with
--   docker exec -i supabase_db_nivolocal psql -U postgres -v ON_ERROR_STOP=1 < supabase/checks/system-history-sweep.check.sql
-- Seeds marked rows, sweeps with a tiny batch until every table is short, asserts exactly the finished-and-old rows are gone and
-- every pending, running, retryable or recent row survives, then rolls everything back (nothing persists).
BEGIN;
CREATE TEMP TABLE before_live AS
  SELECT (SELECT count(*) FROM public.job_outbox WHERE state IN ('queued', 'running')) AS open_outbox,
         (SELECT count(*) FROM public.jobs WHERE status = 'running') AS running_jobs;
SELECT 'before' AS phase, (SELECT count(*) FROM public.jobs) AS jobs, (SELECT count(*) FROM public.job_outbox) AS outbox,
       (SELECT count(*) FROM cron.job_run_details) AS cron_runs, (SELECT count(*) FROM net._http_response) AS http;

-- outbox: marker queue rtcheck; names say what must happen
INSERT INTO public.job_outbox (id, queue, name, dedupe_key, state, created_at, finished_at, sent_at, relay_lease_until) VALUES
 ('00000000-0000-4000-8000-000000000001', 'rtcheck', 'old-done',        'rt:1', 'done',    now() - interval '3 days', now() - interval '2 days', now() - interval '3 days', NULL),
 ('00000000-0000-4000-8000-000000000002', 'rtcheck', 'new-done',        'rt:2', 'done',    now() - interval '1 hour', now() - interval '1 hour', now() - interval '1 hour', NULL),
 ('00000000-0000-4000-8000-000000000003', 'rtcheck', 'failed-3d',       'rt:3', 'failed',  now() - interval '4 days', now() - interval '3 days', now() - interval '4 days', NULL),
 ('00000000-0000-4000-8000-000000000004', 'rtcheck', 'failed-9d',       'rt:4', 'failed',  now() - interval '10 days', now() - interval '9 days', now() - interval '10 days', NULL),
 ('00000000-0000-4000-8000-000000000005', 'rtcheck', 'old-queued',      'rt:5', 'queued',  now() - interval '30 days', NULL, NULL, NULL),
 ('00000000-0000-4000-8000-000000000006', 'rtcheck', 'old-queued-sent', 'rt:6', 'queued',  now() - interval '30 days', NULL, now() - interval '30 days', NULL),
 ('00000000-0000-4000-8000-000000000007', 'rtcheck', 'old-running',     'rt:7', 'running', now() - interval '30 days', NULL, now() - interval '30 days', NULL),
 ('00000000-0000-4000-8000-000000000008', 'rtcheck', 'old-done-leased', 'rt:8', 'done',    now() - interval '3 days', now() - interval '2 days', now() - interval '3 days', now() + interval '1 minute');
INSERT INTO public.job_outbox (queue, name, dedupe_key, state, created_at, finished_at)
  SELECT 'rtcheck', 'bulk-done', 'rtbulk:' || g, 'done', now() - interval '5 days', now() - interval '5 days' FROM generate_series(1, 25) g;

-- jobs: job_key = outbox id as text, status per the real jobs_status_check
INSERT INTO public.jobs (kind, job_key, status, fencing_token, payload, created_at, updated_at) VALUES
 ('rtcheck', '00000000-0000-4000-8000-000000000001', 'done',    1, '{}', now() - interval '3 days', now() - interval '2 days'),
 ('rtcheck', '00000000-0000-4000-8000-000000000002', 'done',    1, '{}', now() - interval '1 hour', now() - interval '1 hour'),
 ('rtcheck', '00000000-0000-4000-8000-000000000003', 'failed',  1, '{}', now() - interval '4 days', now() - interval '3 days'),
 ('rtcheck', '00000000-0000-4000-8000-000000000004', 'failed',  1, '{}', now() - interval '10 days', now() - interval '9 days'),
 ('rtcheck', '00000000-0000-4000-8000-000000000005', 'failed',  1, '{}', now() - interval '30 days', now() - interval '30 days'),
 ('rtcheck', '00000000-0000-4000-8000-000000000007', 'running', 1, '{}', now() - interval '30 days', now() - interval '30 days'),
 ('rtcheck', 'orphan-done',                          'done',    1, '{}', now() - interval '3 days', now() - interval '2 days');

-- cron run log (a jobid no real job has) and pg_net responses
INSERT INTO cron.job_run_details (runid, jobid, status, command, start_time, end_time) VALUES
 (-1, 999999, 'succeeded', 'rtcheck', now() - interval '3 days', now() - interval '3 days'),
 (-2, 999999, 'succeeded', 'rtcheck', now() - interval '1 hour', now() - interval '1 hour'),
 (-3, 999999, 'failed',    'rtcheck', now() - interval '3 days', now() - interval '3 days'),
 (-4, 999999, 'failed',    'rtcheck', now() - interval '9 days', now() - interval '9 days'),
 (-5, 999999, 'running',   'rtcheck', now() - interval '30 days', NULL);
INSERT INTO net._http_response (id, status_code, error_msg, timed_out, created) VALUES
 (-1, 200,  NULL,   false, now() - interval '3 days'),
 (-2, 200,  NULL,   false, now() - interval '1 hour'),
 (-3, 500,  NULL,   false, now() - interval '3 days'),
 (-4, 500,  NULL,   false, now() - interval '9 days'),
 (-5, NULL, 'boom', true,  now() - interval '3 days');

-- Sweep in batches of 10 until every table comes back short, as the app job does.
CREATE TEMP TABLE sweep_log (n serial, result jsonb);
DO $$
declare r jsonb; i int := 0;
begin
  loop
    r := public.system_history_sweep(1, 7, 10);
    insert into sweep_log (result) values (r);
    i := i + 1;
    exit when (r->>'outbox')::int < 10 and (r->>'jobs')::int < 10 and (r->>'cron')::int < 10 and (r->>'http')::int < 10;
    if i > 5000 then raise exception 'sweep does not converge'; end if;
  end loop;
end $$;
SELECT 'sweep batches' AS phase, count(*) AS batches, max((result->>'outbox')::int) AS max_outbox_per_batch FROM sweep_log;

-- Assertions: exactly the expected marker rows remain.
DO $$
declare r text;
begin
  select string_agg(name, ',' order by name) into r from public.job_outbox where queue = 'rtcheck';
  if r is distinct from 'failed-3d,new-done,old-done-leased,old-queued,old-queued-sent,old-running' then raise exception 'outbox survivors wrong: %', r; end if;
  select string_agg(job_key, ',' order by job_key) into r from public.jobs where kind = 'rtcheck';
  if r is distinct from '00000000-0000-4000-8000-000000000002,00000000-0000-4000-8000-000000000003,00000000-0000-4000-8000-000000000005,00000000-0000-4000-8000-000000000007' then raise exception 'jobs survivors wrong: %', r; end if;
  select string_agg(status, ',' order by status, end_time) into r from cron.job_run_details where jobid = 999999;
  if r is distinct from 'failed,running,succeeded' then raise exception 'cron survivors wrong: %', r; end if;
  select string_agg(id::text, ',' order by id desc) into r from net._http_response where id < 0;
  if r is distinct from '-2,-3,-5' then raise exception 'http survivors wrong: %', r; end if;
  if (select count(*) from public.job_outbox where state in ('queued', 'running')) < (select open_outbox from before_live) then raise exception 'live outbox row deleted'; end if;
  if (select count(*) from public.jobs where status = 'running') < (select running_jobs from before_live) then raise exception 'running job deleted'; end if;
end $$;
SELECT 'after' AS phase, (SELECT count(*) FROM public.jobs) AS jobs, (SELECT count(*) FROM public.job_outbox) AS outbox,
       (SELECT count(*) FROM cron.job_run_details) AS cron_runs, (SELECT count(*) FROM net._http_response) AS http;
SELECT 'PASS: only finished history older than its window was deleted' AS verdict;
ROLLBACK;

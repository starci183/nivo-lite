-- End-of-day retention of the system history that grows every minute and nothing prunes: the finished rows of the job queue, the
-- pg_cron run log and the pg_net response log. Additive: one function and one pg_cron tick. A tick only enqueues one outbox row
-- (BE-QUEUES-3); the app job `system_history_retention` claims it and calls the function batch by batch until every table comes back short.
--
-- Deletion rules (one statement deletes at most p_batch rows per table; "finished" = the success window p_done_days, "failed" = the
-- longer window p_failed_days so a failure can still be investigated):
--   public.job_outbox   state done older than p_done_days by finished_at; state failed older than p_failed_days. Never queued or
--                       running (pending relay, retryable or in flight), never a row still holding a relay lease.
--   public.jobs         status done older than p_done_days by updated_at; status failed older than p_failed_days; never running, and
--                       never a row whose outbox row (job_key = outbox id) is still queued or running: a failed claim is retried by
--                       the next claim, so its fencing row must survive until the outbox row is terminal or gone.
--   cron.job_run_details  status succeeded older than p_done_days, status failed older than p_failed_days by end_time; never a run
--                       still starting, running, sending or connecting.
--   net._http_response  a 2xx/3xx answer older than p_done_days; an error, a timeout or a 4xx/5xx answer older than p_failed_days.
-- Rows are locked with SKIP LOCKED so the sweep never waits behind, or blocks, the queue.
BEGIN;

CREATE FUNCTION public.system_history_sweep(p_done_days integer DEFAULT 1, p_failed_days integer DEFAULT 7, p_batch integer DEFAULT 5000)
    RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_done timestamptz := now() - make_interval(days => least(greatest(coalesce(p_done_days, 1), 0), 3650));
  v_failed timestamptz := now() - make_interval(days => least(greatest(coalesce(p_failed_days, 7), 0), 3650));
  v_batch integer := least(greatest(coalesce(p_batch, 5000), 1), 20000);
  v_outbox integer;
  v_jobs integer;
  v_cron integer;
  v_http integer;
begin
  with doomed as (
    select o.id from public.job_outbox o
    where ((o.state = 'done' and coalesce(o.finished_at, o.created_at) < v_done)
        or (o.state = 'failed' and coalesce(o.finished_at, o.created_at) < v_failed))
      and coalesce(o.relay_lease_until, '-infinity'::timestamptz) <= now()
    order by o.created_at limit v_batch for update skip locked
  ), gone as (delete from public.job_outbox o using doomed d where o.id = d.id returning 1)
  select count(*) into v_outbox from gone;

  with doomed as (
    select j.id from public.jobs j
    where ((j.status = 'done' and j.updated_at < v_done) or (j.status = 'failed' and j.updated_at < v_failed))
      and not exists (select 1 from public.job_outbox o where o.id::text = j.job_key and o.state in ('queued', 'running'))
    order by j.updated_at limit v_batch for update skip locked
  ), gone as (delete from public.jobs j using doomed d where j.id = d.id returning 1)
  select count(*) into v_jobs from gone;

  with doomed as (
    select r.runid from cron.job_run_details r
    where ((r.status = 'succeeded' and r.end_time < v_done) or (r.status = 'failed' and r.end_time < v_failed))
    order by r.runid limit v_batch
  ), gone as (delete from cron.job_run_details r using doomed d where r.runid = d.runid returning 1)
  select count(*) into v_cron from gone;

  with doomed as (
    select h.ctid as row_id from net._http_response h
    where (h.created < v_failed)
       or (h.created < v_done and h.error_msg is null and coalesce(h.timed_out, false) = false and h.status_code < 400)
    order by h.created limit v_batch
  ), gone as (delete from net._http_response h using doomed d where h.ctid = d.row_id returning 1)
  select count(*) into v_http from gone;

  return jsonb_build_object('outbox', v_outbox, 'jobs', v_jobs, 'cron', v_cron, 'http', v_http, 'batch', v_batch);
end $$;

REVOKE EXECUTE ON FUNCTION public.system_history_sweep(integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_history_sweep(integer, integer, integer) TO app_be;

-- 23:30 Asia/Ho_Chi_Minh (UTC+7, no DST) is 16:30 on the cron clock (cron.timezone is GMT). The windows ride in the payload: change
-- them with cron.alter_job; `cli jobs tick system-history-retention` sends the same tick by hand.
COMMIT;

-- The lite database runs the official postgres image with pgvector only (owner ruling 2026-10-29): pg_cron's ticks move to
-- platform/jobs in the back end and pg_net is gone, so no kept function may name the cron or net schemas. The retention sweep keeps
-- its job and outbox pruning and answers 0 for the two logs it no longer owns (the job reads the same four counts), and the hiring
-- status answers an empty cron list, which is what it already answered when pg_cron was unreachable.

CREATE OR REPLACE FUNCTION public.system_history_sweep(p_done_days integer DEFAULT 1, p_failed_days integer DEFAULT 7, p_batch integer DEFAULT 5000)
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

  return jsonb_build_object('outbox', v_outbox, 'jobs', v_jobs, 'cron', 0, 'http', 0, 'batch', v_batch);
end $$;

REVOKE EXECUTE ON FUNCTION public.system_history_sweep(integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_history_sweep(integer, integer, integer) TO app_be;

CREATE OR REPLACE FUNCTION public.hiring_ops_status() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_due int;
begin
  select count(*) into v_due from public.hiring_candidates c join public.hiring_settings s on s.workspace_id = c.workspace_id
    where c.stage in ('rejected', 'withdrawn') and c.stage_changed_at < now() - make_interval(days => s.retention_days);
  return jsonb_build_object('cron', '[]'::jsonb, 'retention_due', v_due);
end $$;

REVOKE EXECUTE ON FUNCTION public.hiring_ops_status() FROM PUBLIC, anon, authenticated;

-- Follow-up to 20261004100000_engine_jobs.sql (that file is frozen: it is already applied to the cloud database).
--   1. The scheduled connection.health tick must not pile up rows while no worker is running: skip a workspace that already has
--      one queued or running, and cancel queued ticks that nobody picked up within an hour (they are stale by then anyway).
--   2. engine_mark_connection_health(): the one atomic write the connection.health job makes (merges `health` into public_meta).

create or replace function public.engine_schedule_connection_health()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.engine_jobs set status = 'cancelled', error = 'stale: no worker claimed it within an hour', finished_at = now()
   where kind = 'connection.health' and status = 'queued' and created_at < now() - interval '1 hour';
  select count(*) into v_count from (
    select public.engine_enqueue(w.workspace_id, 'connection.health', '{}'::jsonb,
             'connection.health:' || w.workspace_id || ':' || floor(extract(epoch from now()) / 900)::bigint, now(), 2)
      from (select distinct c.workspace_id from public.connections c
             where c.status <> 'disconnected'
               and not exists (select 1 from public.engine_jobs j
                                where j.workspace_id = c.workspace_id and j.kind = 'connection.health' and j.status in ('queued', 'running'))) w
  ) q;
  return v_count;
end $$;

create or replace function public.engine_mark_connection_health(p_workspace uuid, p_connection uuid, p_health jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  update public.connections set public_meta = coalesce(public_meta, '{}'::jsonb) || jsonb_build_object('health', p_health)
   where id = p_connection and workspace_id = p_workspace;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;
revoke all on function public.engine_mark_connection_health(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.engine_mark_connection_health(uuid, uuid, jsonb) to service_role;

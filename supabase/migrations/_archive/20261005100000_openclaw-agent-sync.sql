-- OpenClaw keeps a COPY of each openclaw-processor agent (AGENTS.md, SOUL.md, knowledge/*.md in its workspace). Supabase stays the source of truth;
-- the engine job `openclaw.sync_agent` rebuilds that copy one-way and records what it wrote here.
--   openclaw_agent_sync          one row per installation: which context version and content hash OpenClaw holds, when, and the last error
--   engine_enqueue_agent_sync    enqueue ONE sync for an installation (skips when a queued one already exists: bursts of edits collapse)
--   engine_enqueue_workspace_sync  the same for every openclaw installation of a workspace (knowledge changed)
--   engine_schedule_agent_sync   every installation whose processor is 'openclaw'; pg_cron runs it every 5 minutes, the engine at startup

create table public.openclaw_agent_sync (
  installation_id uuid primary key references public.module_installations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id text not null,                       -- the OpenClaw agent id: ws-<8 hex>-<module>
  context_version int,                          -- the active context version the files were built from (null = none applied yet)
  content_hash text,                            -- sha256 over every file (path + content)
  synced_at timestamptz,                        -- last time the files were (re)written
  checked_at timestamptz not null default now(),-- last time the sync ran and found / made the copy current
  status text not null default 'ok' check (status in ('ok', 'error')),
  error text,
  files jsonb not null default '[]'::jsonb      -- [{path, bytes, sha256}] (no content)
);
create index openclaw_agent_sync_workspace on public.openclaw_agent_sync (workspace_id);
alter table public.openclaw_agent_sync enable row level security;
create policy openclaw_agent_sync_read on public.openclaw_agent_sync for select to authenticated using (public.is_member(workspace_id));
revoke all on public.openclaw_agent_sync from anon, authenticated;
grant select on public.openclaw_agent_sync to authenticated;
grant all on public.openclaw_agent_sync to service_role;

-- A sync job may be queued for any installation. p_force = true also syncs an installation that is not (yet) on OpenClaw (the "Đồng bộ lại" button).
create or replace function public.engine_enqueue_agent_sync(p_installation uuid, p_force boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare i public.module_installations; v_id uuid;
begin
  select * into i from public.module_installations where id = p_installation;
  if not found then return null; end if;
  if not p_force and coalesce(i.settings ->> 'processor', 'nivo') <> 'openclaw' then return null; end if;
  select id into v_id from public.engine_jobs
   where kind = 'openclaw.sync_agent' and status = 'queued' and payload ->> 'installation_id' = p_installation::text
   order by created_at limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.engine_jobs (workspace_id, kind, payload, dedupe_key, max_attempts)
  values (i.workspace_id, 'openclaw.sync_agent', jsonb_build_object('installation_id', p_installation),
          'openclaw.sync_agent:' || p_installation || ':' || gen_random_uuid(), 3)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.engine_enqueue_workspace_sync(p_workspace uuid)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.module_installations where workspace_id = p_workspace and coalesce(settings ->> 'processor', 'nivo') = 'openclaw' loop
    perform public.engine_enqueue_agent_sync(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.engine_schedule_agent_sync()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  update public.engine_jobs set status = 'cancelled', error = 'stale: no worker claimed it within an hour', finished_at = now()
   where kind = 'openclaw.sync_agent' and status = 'queued' and created_at < now() - interval '1 hour';
  for r in select id from public.module_installations where coalesce(settings ->> 'processor', 'nivo') = 'openclaw' loop
    perform public.engine_enqueue_agent_sync(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.engine_enqueue_agent_sync(uuid, boolean) from public, anon, authenticated;
revoke all on function public.engine_enqueue_workspace_sync(uuid) from public, anon, authenticated;
revoke all on function public.engine_schedule_agent_sync() from public, anon, authenticated;
grant execute on function public.engine_enqueue_agent_sync(uuid, boolean) to service_role;
grant execute on function public.engine_enqueue_workspace_sync(uuid) to service_role;
grant execute on function public.engine_schedule_agent_sync() to service_role;

-- pg_cron every 5 minutes (optional extension: the migration still applies where it is missing).
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron is not available here (%); engine_schedule_agent_sync() is not scheduled', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('engine-openclaw-agent-sync', '*/5 * * * *', 'select public.engine_schedule_agent_sync()');
    exception when others then
      raise notice 'could not schedule engine-openclaw-agent-sync (%)', sqlerrm;
    end;
  end if;
end $$;

-- 1. Outage sweeper: no customer message may sit unanswered because the engine or OpenClaw is broken.
--    pg_cron calls the app route /api/engine/sweep every minute through pg_net. The route authenticates with a secret that lives only in
--    the Vault (name engine_sweep_secret); the app asks engine_sweep_authorized() to compare, so no secret is in the repo or in app env.
--    engine_sweep_claim() cancels, atomically, the chat.turn jobs that are still queued after 30 s or running past their deadline
--    (the installation's openclawTimeoutSec, default 25, plus 15 s), so the engine can no longer answer them; the app answers them with the direct model.
-- 2. OpenClaw is the default processor of every installation: backfill + the schedule functions treat a missing setting as 'openclaw'.

create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'engine_sweep_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'engine_sweep_secret', 'shared secret of the pg_cron -> /api/engine/sweep call');
  end if;
end $$;

create or replace function public.engine_sweep_authorized(p_secret text)
returns boolean language sql stable security definer set search_path = public, vault as $$
  select p_secret is not null and p_secret <> '' and exists (select 1 from vault.decrypted_secrets s where s.name = 'engine_sweep_secret' and s.decrypted_secret = p_secret);
$$;

create or replace function public.engine_sweep_claim()
returns setof public.engine_jobs language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select j.id
      from public.engine_jobs j
      left join public.module_installations i on i.agent_id::text = j.payload ->> 'agent_id'
     where j.kind = 'chat.turn'
       and ((j.status = 'queued' and j.created_at < now() - interval '30 seconds')
         or (j.status = 'running' and j.created_at < now() - make_interval(secs => coalesce(nullif(i.settings ->> 'openclawTimeoutSec', '')::int, 25) + 15)))
     for update of j skip locked
  )
  update public.engine_jobs j
     set status = 'cancelled', error = 'fallback: engine_timeout', finished_at = now(), locked_by = null, locked_until = null
    from due where j.id = due.id
  returning j.*;
end $$;

revoke all on function public.engine_sweep_authorized(text) from public, anon, authenticated;
revoke all on function public.engine_sweep_claim() from public, anon, authenticated;
grant execute on function public.engine_sweep_authorized(text) to service_role;
grant execute on function public.engine_sweep_claim() to service_role;

-- 2. Default processor: OpenClaw everywhere.
update public.module_installations set settings = coalesce(settings, '{}'::jsonb) || '{"processor": "openclaw"}'::jsonb where settings ->> 'processor' is distinct from 'openclaw';
alter table public.module_installations alter column settings set default '{"processor": "openclaw"}'::jsonb;

create or replace function public.engine_enqueue_agent_sync(p_installation uuid, p_force boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare i public.module_installations; v_id uuid;
begin
  select * into i from public.module_installations where id = p_installation;
  if not found then return null; end if;
  if not p_force and coalesce(i.settings ->> 'processor', 'openclaw') <> 'openclaw' then return null; end if;
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
  for r in select id from public.module_installations where workspace_id = p_workspace and coalesce(settings ->> 'processor', 'openclaw') = 'openclaw' loop
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
  for r in select id from public.module_installations where coalesce(settings ->> 'processor', 'openclaw') = 'openclaw' loop
    perform public.engine_enqueue_agent_sync(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- pg_cron every minute -> pg_net POST (the secret is read from the Vault at call time).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    begin
      perform cron.schedule('engine-sweep', '* * * * *', $cron$
        select net.http_post(
          url := 'https://nivo.vn/api/engine/sweep',
          headers := jsonb_build_object('content-type', 'application/json', 'x-sweep-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'engine_sweep_secret')),
          body := '{}'::jsonb,
          timeout_milliseconds := 55000)
      $cron$);
    exception when others then
      raise notice 'could not schedule engine-sweep (%)', sqlerrm;
    end;
  else
    raise notice 'pg_cron or pg_net missing: engine-sweep is not scheduled';
  end if;
end $$;

-- NIVO engine: a durable job queue for the long-running worker at /engine (a separate process on a VPS).
-- The Next app is the control plane (UI, authority gate, evidence); the engine claims jobs from here and never writes to a
-- customer channel itself: its results come back through signed callbacks and pass the authority gate like any other input.
--   engine_jobs      the queue (queued -> running -> done | failed | cancelled), leased with `for update skip locked`
--   engine_workers   one row per running worker, upserted as a heartbeat (read through engine_status(), never directly)
--   engine_*()       service-role only RPCs: enqueue, claim, heartbeat, complete, fail (retry with backoff), release
-- Which processor answers a module's customers is `module_installations.settings ->> 'processor'`:
--   'nivo' (default, also when absent)  the app calls the model directly   |   'openclaw'  the app enqueues a `chat.turn` job.
-- It is jsonb, so no column is added.

create table public.engine_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade, -- null = a platform-wide job
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  attempts int not null default 0,
  max_attempts int not null default 3 check (max_attempts >= 1),
  run_at timestamptz not null default now(),
  locked_by text,
  locked_until timestamptz,
  result jsonb,
  error text,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index engine_jobs_claim on public.engine_jobs (run_at, created_at) where status in ('queued', 'running');
create index engine_jobs_workspace on public.engine_jobs (workspace_id, created_at desc);

create table public.engine_workers (
  worker_id text primary key,
  version text not null default '',
  kinds text[] not null default '{}',
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  info jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------- RLS: members read their workspace's jobs; nobody writes from a client
alter table public.engine_jobs enable row level security;
alter table public.engine_workers enable row level security;
create policy engine_jobs_read on public.engine_jobs for select to authenticated using (workspace_id is not null and public.is_member(workspace_id));
revoke all on public.engine_jobs from anon, authenticated;
grant select on public.engine_jobs to authenticated;
revoke all on public.engine_workers from anon, authenticated;

-- ---------------------------------------------------------------- RPCs (security definer, service role only)
create or replace function public.engine_enqueue(
  p_workspace uuid, p_kind text, p_payload jsonb default '{}'::jsonb, p_dedupe_key text default null,
  p_run_at timestamptz default now(), p_max_attempts int default 3
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.engine_jobs (workspace_id, kind, payload, dedupe_key, run_at, max_attempts)
  values (p_workspace, p_kind, coalesce(p_payload, '{}'::jsonb), p_dedupe_key, coalesce(p_run_at, now()), greatest(p_max_attempts, 1))
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  if v_id is null then select id into v_id from public.engine_jobs where dedupe_key = p_dedupe_key; end if;
  return v_id;
end $$;

-- Claim up to p_limit due jobs of the given kinds. A running job whose lease expired is re-claimable (its worker died);
-- one that has used all its attempts is failed instead of being run again.
create or replace function public.engine_claim_jobs(p_worker text, p_kinds text[], p_limit int default 1, p_lease_seconds int default 60)
returns setof public.engine_jobs language plpgsql security definer set search_path = public as $$
begin
  update public.engine_jobs
     set status = 'failed', error = coalesce(error, 'lease expired after the last attempt'), finished_at = now(), locked_by = null, locked_until = null
   where status = 'running' and locked_until < now() and attempts >= max_attempts and kind = any (p_kinds);
  return query
  with picked as (
    select id from public.engine_jobs
     where kind = any (p_kinds) and run_at <= now()
       and (status = 'queued' or (status = 'running' and locked_until < now()))
     order by run_at, created_at
     limit greatest(p_limit, 0)
     for update skip locked
  )
  update public.engine_jobs j
     set status = 'running', attempts = j.attempts + 1, locked_by = p_worker, locked_until = now() + make_interval(secs => p_lease_seconds)
    from picked where j.id = picked.id
  returning j.*;
end $$;

-- Extend the lease. False = the job is no longer this worker's (lease lost, cancelled): the worker must stop.
create or replace function public.engine_heartbeat_job(p_job uuid, p_worker text, p_lease_seconds int default 60)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  update public.engine_jobs set locked_until = now() + make_interval(secs => p_lease_seconds)
   where id = p_job and locked_by = p_worker and status = 'running';
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

create or replace function public.engine_complete_job(p_job uuid, p_worker text, p_result jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  update public.engine_jobs set status = 'done', result = p_result, error = null, finished_at = now(), locked_by = null, locked_until = null
   where id = p_job and locked_by = p_worker and status = 'running';
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

-- Fail an attempt. Retried with exponential backoff (5s, 10s, 20s ... capped at 15 min, or p_retry_after_seconds) until
-- max_attempts is used up, then 'failed'. p_permanent skips the retries. Returns the job's new status (null = not this worker's).
create or replace function public.engine_fail_job(p_job uuid, p_worker text, p_error text, p_retry_after_seconds int default null, p_permanent boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare j public.engine_jobs; v_status text;
begin
  select * into j from public.engine_jobs where id = p_job and locked_by = p_worker and status = 'running' for update;
  if not found then return null; end if;
  if p_permanent or j.attempts >= j.max_attempts then
    update public.engine_jobs set status = 'failed', error = left(p_error, 2000), finished_at = now(), locked_by = null, locked_until = null where id = j.id;
    v_status := 'failed';
  else
    update public.engine_jobs
       set status = 'queued', error = left(p_error, 2000), locked_by = null, locked_until = null,
           run_at = now() + make_interval(secs => coalesce(p_retry_after_seconds, least(5 * power(2, greatest(j.attempts - 1, 0))::int, 900)))
     where id = j.id;
    v_status := 'queued';
  end if;
  return v_status;
end $$;

-- Hand a job back untouched (graceful shutdown): it goes back to queued and the attempt is not counted.
create or replace function public.engine_release_job(p_job uuid, p_worker text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  update public.engine_jobs set status = 'queued', attempts = greatest(attempts - 1, 0), locked_by = null, locked_until = null
   where id = p_job and locked_by = p_worker and status = 'running';
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

create or replace function public.engine_worker_heartbeat(p_worker text, p_version text, p_kinds text[], p_info jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.engine_workers (worker_id, version, kinds, info, last_heartbeat_at)
  values (p_worker, coalesce(p_version, ''), coalesce(p_kinds, '{}'), coalesce(p_info, '{}'::jsonb), now())
  on conflict (worker_id) do update set version = excluded.version, kinds = excluded.kinds, info = excluded.info, last_heartbeat_at = now();
$$;

revoke all on function public.engine_enqueue(uuid, text, jsonb, text, timestamptz, int) from public, anon, authenticated;
revoke all on function public.engine_claim_jobs(text, text[], int, int) from public, anon, authenticated;
revoke all on function public.engine_heartbeat_job(uuid, text, int) from public, anon, authenticated;
revoke all on function public.engine_complete_job(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.engine_fail_job(uuid, text, text, int, boolean) from public, anon, authenticated;
revoke all on function public.engine_release_job(uuid, text) from public, anon, authenticated;
revoke all on function public.engine_worker_heartbeat(text, text, text[], jsonb) from public, anon, authenticated;
grant execute on function public.engine_enqueue(uuid, text, jsonb, text, timestamptz, int) to service_role;
grant execute on function public.engine_claim_jobs(text, text[], int, int) to service_role;
grant execute on function public.engine_heartbeat_job(uuid, text, int) to service_role;
grant execute on function public.engine_complete_job(uuid, text, jsonb) to service_role;
grant execute on function public.engine_fail_job(uuid, text, text, int, boolean) to service_role;
grant execute on function public.engine_release_job(uuid, text) to service_role;
grant execute on function public.engine_worker_heartbeat(text, text, text[], jsonb) to service_role;

-- What the settings screen may know about the engine: the last heartbeat and whether it is recent. Any signed-in member.
create or replace function public.engine_status()
returns table (last_heartbeat_at timestamptz, workers int, online boolean)
language sql stable security definer set search_path = public as $$
  select max(w.last_heartbeat_at), count(*)::int, coalesce(max(w.last_heartbeat_at) > now() - interval '90 seconds', false)
    from public.engine_workers w
   where auth.uid() is not null;
$$;
revoke all on function public.engine_status() from public, anon;
grant execute on function public.engine_status() to authenticated, service_role;

-- ---------------------------------------------------------------- scheduled example: connection.health every 15 minutes
-- One queue row per workspace that has a live connection; the dedupe key makes a double tick harmless.
create or replace function public.engine_schedule_connection_health()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  select count(*) into v_count from (
    select public.engine_enqueue(w.workspace_id, 'connection.health', '{}'::jsonb,
             'connection.health:' || w.workspace_id || ':' || floor(extract(epoch from now()) / 900)::bigint, now(), 2)
      from (select distinct workspace_id from public.connections where status <> 'disconnected') w
  ) q;
  return v_count;
end $$;
revoke all on function public.engine_schedule_connection_health() from public, anon, authenticated;
grant execute on function public.engine_schedule_connection_health() to service_role;

-- pg_cron is optional: where the extension is missing the migration still applies (call the function from any other scheduler).
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron is not available here (%); engine_schedule_connection_health() is not scheduled', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('engine-connection-health', '*/15 * * * *', 'select public.engine_schedule_connection_health()');
    exception when others then
      raise notice 'could not schedule engine-connection-health (%)', sqlerrm;
    end;
  end if;
end $$;

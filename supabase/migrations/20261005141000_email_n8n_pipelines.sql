-- Shared n8n pipelines that send email (resources/n8n-templates/<key>.json, one workflow per template for ALL businesses).
--   n8n_pipelines        one row per workspace per template: on/off + the shop's settings and approved wording (config)
--   n8n_runs             one row per run. The run token (hash only, with an expiry) is what n8n presents to /api/n8n/*; one run = one workspace
--   n8n_platform_config  api_base: the public URL n8n calls back (default https://nivo.vn)
--   n8n_start_run()      creates the run and queues an engine job `n8n.emit` aimed at http://n8n:5678/webhook/nivo/<key>
--   n8n_schedule_pipelines()  pg_cron every 10 minutes: starts the time-driven pipelines (daily report, debt reminder, month ledger)
-- Merging with the automations lane: these rows are the executor 'n8n' of a template; map n8n_pipelines -> automation_pipelines(config)
-- and n8n_runs -> automation_runs, keep n8n_start_run as the executor entry point.
create table public.n8n_pipelines (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  template_key text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, template_key)
);
create table public.n8n_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  template_key text not null,
  dedupe_key text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'skipped')),
  summary text,
  result jsonb,
  engine_job_id uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (workspace_id, template_key, dedupe_key)
);
create index n8n_runs_workspace on public.n8n_runs (workspace_id, created_at desc);
create table public.n8n_platform_config (key text primary key, value text not null);
insert into public.n8n_platform_config (key, value) values ('api_base', 'https://nivo.vn') on conflict do nothing;

alter table public.n8n_pipelines enable row level security;
alter table public.n8n_runs enable row level security;
alter table public.n8n_platform_config enable row level security;
create policy n8n_pipelines_read on public.n8n_pipelines for select to authenticated using (public.is_member(workspace_id));
create policy n8n_runs_read on public.n8n_runs for select to authenticated using (public.is_member(workspace_id));
revoke all on public.n8n_pipelines, public.n8n_runs, public.n8n_platform_config from anon, authenticated;
grant select on public.n8n_pipelines to authenticated;
grant select (id, workspace_id, template_key, status, summary, created_at, finished_at) on public.n8n_runs to authenticated;

create or replace function public.n8n_start_run(
  p_workspace uuid, p_key text, p_data jsonb default '{}'::jsonb, p_dedupe text default null, p_force boolean default false, p_api_base text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_cfg jsonb; v_enabled boolean; v_run uuid := gen_random_uuid(); v_token text; v_base text; v_job uuid;
begin
  if p_key !~ '^[a-z][a-z0-9-]{2,60}$' then raise exception 'bad template key'; end if;
  select config, enabled into v_cfg, v_enabled from public.n8n_pipelines where workspace_id = p_workspace and template_key = p_key;
  if not found or (not v_enabled and not p_force) then return null; end if;
  v_token := v_run::text || '.' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_base := coalesce(p_api_base, (select value from public.n8n_platform_config where key = 'api_base'), 'https://nivo.vn');
  insert into public.n8n_runs (id, workspace_id, template_key, dedupe_key, token_hash, expires_at)
  values (v_run, p_workspace, p_key, coalesce(p_dedupe, v_run::text), encode(sha256(convert_to(v_token, 'utf8')), 'hex'), now() + interval '30 minutes')
  on conflict (workspace_id, template_key, dedupe_key) do nothing;
  if not found then return null; end if;
  v_job := public.engine_enqueue(
    p_workspace, 'n8n.emit',
    jsonb_build_object('event', 'pipeline.' || p_key, 'urls', jsonb_build_array('http://n8n:5678/webhook/nivo/' || p_key),
      'data', jsonb_build_object('run_id', v_run, 'run_token', v_token, 'api_base', v_base, 'template_key', p_key, 'config', v_cfg, 'data', coalesce(p_data, '{}'::jsonb))),
    'n8n:' || v_run, now(), 3);
  update public.n8n_runs set engine_job_id = v_job where id = v_run;
  return v_run;
end $$;

-- Time-driven pipelines. Vietnam time. The dedupe key (per day / per month) makes a double tick or a catch-up harmless.
create or replace function public.n8n_schedule_pipelines()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record; v_local timestamp := now() at time zone 'Asia/Ho_Chi_Minh'; v_at time; v_count int := 0; v_id uuid; v_period text;
begin
  for r in select workspace_id, template_key, config from public.n8n_pipelines
            where enabled and template_key in ('email-daily-report', 'email-debt-reminder', 'email-month-ledger') loop
    v_at := coalesce(nullif(r.config ->> 'time', ''), case r.template_key when 'email-daily-report' then '21:00' when 'email-debt-reminder' then '09:00' else '07:00' end)::time;
    if v_local::time < v_at or v_local::time >= v_at + interval '3 hours' then continue; end if;
    if r.template_key = 'email-month-ledger' then
      if extract(day from v_local) <> 1 then continue; end if;
      v_period := to_char(date_trunc('month', v_local) - interval '1 month', 'YYYY-MM');
      v_id := public.n8n_start_run(r.workspace_id, r.template_key, jsonb_build_object('period', v_period), 'month:' || v_period);
    else
      v_id := public.n8n_start_run(r.workspace_id, r.template_key, jsonb_build_object('date', v_local::date), 'day:' || v_local::date);
    end if;
    if v_id is not null then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end $$;

revoke all on function public.n8n_start_run(uuid, text, jsonb, text, boolean, text) from public, anon, authenticated;
revoke all on function public.n8n_schedule_pipelines() from public, anon, authenticated;
grant execute on function public.n8n_start_run(uuid, text, jsonb, text, boolean, text) to service_role;
grant execute on function public.n8n_schedule_pipelines() to service_role;

do $$
begin
  begin create extension if not exists pg_cron; exception when others then raise notice 'pg_cron is not available here (%)', sqlerrm; end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('nivo-n8n-pipelines', '*/10 * * * *', 'select public.n8n_schedule_pipelines()');
    exception when others then
      raise notice 'could not schedule nivo-n8n-pipelines (%)', sqlerrm;
    end;
  end if;
end $$;

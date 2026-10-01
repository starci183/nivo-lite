-- Ready-made automations ("Tự động hoá"): templates the owner switches on, and the history of what each one did.
--   automation_pipelines  one row per template per workspace (template_key is unique per workspace): on/off, settings in config.
--   automation_runs       one row per trigger; dedupe_key is unique per pipeline, so the same trigger never runs twice.
-- Members read; owner/manager write pipelines; runs are written by the app (service role) only.
-- Time triggers: pg_cron calls automation_tick() every minute, which POSTs the app route /api/automation/tick through pg_net,
-- signed with HMAC-SHA256 over the timestamp. The URL and the key live in Supabase Vault ('nivo_tick_url', 'nivo_tick_key'); with
-- either missing, or pg_net / pg_cron unavailable, the tick is simply not scheduled (any external scheduler can call the route).

create table public.automation_pipelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  template_key text not null,
  name text not null,
  module_key text check (module_key in ('chatbot', 'sales', 'accounting')), -- exactly one owner: a module, or null = the whole workspace
  enabled boolean not null default false,
  dismissed boolean not null default false, -- the owner pressed "Không áp dụng"
  config jsonb not null default '{}'::jsonb,
  body text, -- the shop's approved message template (variables like {ten_khach}); generated once from the active context, then edited/approved by the owner
  body_version int not null default 0,
  template_version int not null default 1,
  based_on_context int, -- the active context version the body was written from
  approval_streak int not null default 0, -- consecutive owner approvals without edits (trust ladder)
  trust_offered_at timestamptz,
  auto_send boolean not null default false, -- the owner accepted "Cho tự gửi"
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, template_key)
);
-- The catalogue itself lives in resources/automation-templates/<key>.json; `npm run seed:automations` mirrors it here (upsert by key).
create table public.automation_templates (
  key text primary key,
  version int not null default 1,
  module_key text,
  pack text not null default 'core',
  executor text not null default 'implemented',
  definition jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.automation_templates enable row level security;
create policy automation_templates_read on public.automation_templates for select to authenticated using (true);
revoke all on public.automation_templates from anon, authenticated;
grant select on public.automation_templates to authenticated;

create index automation_pipelines_enabled on public.automation_pipelines (template_key) where enabled;

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.automation_pipelines (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trigger_ref text not null default '',
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb, -- what the trigger carried (a retry or a scheduled run is executed from it)
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'skipped', 'waiting_approval', 'failed')),
  steps jsonb not null default '[]'::jsonb,
  evidence text,
  error text,
  attempts int not null default 0,
  run_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (pipeline_id, dedupe_key)
);
create index automation_runs_pipeline on public.automation_runs (pipeline_id, created_at desc);
create index automation_runs_workspace on public.automation_runs (workspace_id, created_at desc);
create index automation_runs_due on public.automation_runs (run_at) where status in ('queued', 'failed');

alter table public.automation_pipelines enable row level security;
alter table public.automation_runs enable row level security;
create policy automation_pipelines_read on public.automation_pipelines for select to authenticated using (public.is_member(workspace_id));
create policy automation_pipelines_write on public.automation_pipelines for all to authenticated
  using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy automation_runs_read on public.automation_runs for select to authenticated using (public.is_member(workspace_id));
revoke all on public.automation_runs from anon, authenticated;
grant select on public.automation_runs to authenticated;

-- ---------------------------------------------------------------- the minute tick
create or replace function public.automation_tick()
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_key text; v_ts text := (floor(extract(epoch from now()) * 1000))::bigint::text;
begin
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'nivo_tick_url' limit 1;
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivo_tick_key' limit 1;
  exception when others then
    return false;
  end;
  if v_url is null or v_key is null then return false; end if;
  if not exists (select 1 from public.automation_pipelines where enabled) then return false; end if;
  perform net.http_post(
    url := v_url, body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-tick-timestamp', v_ts,
      'x-tick-signature', encode(extensions.hmac(v_ts, v_key, 'sha256'), 'hex')),
    timeout_milliseconds := 20000);
  return true;
exception when others then
  raise notice 'automation_tick failed: %', sqlerrm;
  return false;
end $$;
revoke all on function public.automation_tick() from public, anon, authenticated;
grant execute on function public.automation_tick() to service_role;

do $$
begin
  begin create extension if not exists pg_net; exception when others then raise notice 'pg_net is not available here (%)', sqlerrm; end;
  begin create extension if not exists pg_cron; exception when others then raise notice 'pg_cron is not available here (%)', sqlerrm; end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('nivo-automation-tick', '* * * * *', 'select public.automation_tick()');
    exception when others then
      raise notice 'could not schedule nivo-automation-tick (%)', sqlerrm;
    end;
  end if;
end $$;

-- Automations and the shared n8n workflows move into the back end (be/): the engine ticks from a pgmq queue, n8n deliveries are queue
-- jobs, the catalogue is written by the cli (seed-automations) and the overview is read by the api through automations_data.
--   * queues `automation` (the minute tick; its pg_cron scheduler is registered by the back end) and `n8n` (one delivery per run);
--   * automation_templates.position keeps the order of the gallery;
--   * automations_data(ws) also answers the contracts, the shipped orders and the department of each rule, as the back end reads them;
--   * the SQL that posted ticks and deliveries over pg_net (automation_tick, n8n_start_run, n8n_schedule_pipelines) and their cron jobs go.

select pgmq.create('automation');
select pgmq.create('n8n');

alter table public.automation_templates add column if not exists position int not null default 0;

create or replace function public.automations_data(ws uuid)
returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'installations', coalesce((select jsonb_agg(jsonb_build_object('module_key', i.module_key, 'operating_mode', i.operating_mode,
                                  'ctx', (select jsonb_build_object('id', v.id, 'version', v.version, 'snapshot', v.snapshot)
                                          from module_context_versions v where v.id = i.active_context_version_id)) order by i.created_at)
                               from module_installations i where i.workspace_id = ws), '[]'::jsonb),
    'pipelines', coalesce((select jsonb_agg(to_jsonb(p)) from automation_pipelines p where p.workspace_id = ws), '[]'::jsonb),
    'runs', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'pipeline_id', r.pipeline_id, 'trigger_ref', r.trigger_ref, 'status', r.status,
                                  'steps', r.steps, 'evidence', r.evidence, 'error', r.error, 'created_at', r.created_at, 'finished_at', r.finished_at)
                                  order by r.created_at desc)
                      from (select * from automation_runs where workspace_id = ws order by created_at desc limit 80) r), '[]'::jsonb),
    'google', (select jsonb_build_object('id', c.id, 'status', c.status, 'last_error', c.last_error, 'public_meta', c.public_meta, 'name', c.name)
               from connections c where c.workspace_id = ws and c.provider = 'google' and c.status <> 'disconnected' order by c.created_at limit 1),
    'knowledge', coalesce((select jsonb_agg(jsonb_build_object('title', k.title, 'content', k.content))
                           from (select title, content from knowledge_sources where workspace_id = ws limit 60) k), '[]'::jsonb),
    'due_invoices', (select count(*) from invoices where workspace_id = ws and due_at is not null),
    'connections', coalesce((select jsonb_agg(jsonb_build_object('provider', c.provider, 'status', c.status))
                             from connections c where c.workspace_id = ws and c.status <> 'disconnected'), '[]'::jsonb),
    'chat_agents', (select count(*) from agents where workspace_id = ws and module in ('chatbot', 'booking') and status = 'active'),
    'workspace_name', (select name from workspaces where id = ws),
    'authority', (select jsonb_build_object('reply_style', a.reply_style, 'brand_voice', a.brand_voice) from authority a where a.workspace_id = ws),
    'rules', coalesce((select jsonb_agg(jsonb_build_object('department', r.department, 'action', r.action, 'mode', r.mode))
                       from authority_rules r where r.workspace_id = ws), '[]'::jsonb),
    'contracts', (select count(*) from contracts where workspace_id = ws),
    'shipped_orders', (select count(*) from orders where workspace_id = ws and shipped_at is not null)
  );
$$;

revoke all on function public.automations_data(uuid) from public, anon;
grant execute on function public.automations_data(uuid) to authenticated, service_role, app_be;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('nivo-automation-tick', 'nivo-n8n-pipelines');
  end if;
end $$;

drop function if exists public.automation_tick();
drop function if exists public.n8n_schedule_pipelines();
drop function if exists public.n8n_start_run(uuid, text, jsonb, text, boolean, text);

-- The two things only the back end can do for a manager, run through a command: write the shop's own wording with a model, and start a
-- scheduled n8n workflow now. The screen calls automation_command_enqueue (a SECURITY DEFINER rpc that proves the manager and queues the
-- job in the same transaction); the back-end job executes it and writes the answer on the row, which the screen reads through RLS.
create table if not exists public.automation_commands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('propose_body', 'run_now')),
  template_key text not null check (template_key ~ '^[a-z][a-z0-9_-]{2,60}$'),
  status text not null default 'queued' check (status in ('queued', 'done', 'failed')),
  result jsonb,
  fault_code text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists automation_commands_workspace on public.automation_commands (workspace_id, created_at desc);

alter table public.automation_commands enable row level security;
revoke all on public.automation_commands from anon, authenticated;
grant select on public.automation_commands to authenticated;
drop policy if exists "automation_commands_manager_select" on public.automation_commands;
create policy "automation_commands_manager_select" on public.automation_commands for select to authenticated
  using (public.is_manager(workspace_id));

grant select, update on table public.automation_commands to app_be;
drop policy if exists "automation_commands_app_be_select" on public.automation_commands;
create policy "automation_commands_app_be_select" on public.automation_commands for select to app_be using (workspace_id is not null);
drop policy if exists "automation_commands_app_be_update" on public.automation_commands;
create policy "automation_commands_app_be_update" on public.automation_commands for update to app_be
  using (workspace_id is not null) with check (workspace_id is not null);

create or replace function public.automation_command_enqueue(p_workspace uuid, p_kind text, p_template text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null or not public.is_manager(p_workspace) then
    raise exception 'automation_command_enqueue: not a manager of the workspace' using errcode = '42501';
  end if;
  insert into public.automation_commands (workspace_id, kind, template_key, created_by)
  values (p_workspace, p_kind, p_template, (select auth.uid()))
  returning id into v_id;
  perform public.job_enqueue(p_workspace, 'automation', 'automation.command',
    jsonb_build_object('commandId', v_id), 'automation.command:' || v_id::text);
  return v_id;
end $$;

revoke all on function public.automation_command_enqueue(uuid, text, text) from public, anon;
grant execute on function public.automation_command_enqueue(uuid, text, text) to authenticated;

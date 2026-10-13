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

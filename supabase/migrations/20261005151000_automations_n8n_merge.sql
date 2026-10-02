-- ONE automations surface. The shared n8n email pipelines (migration 20261005141000, executor 'n8n') become templates of the same gallery:
--   n8n_pipelines -> automation_pipelines  (settings in config, the shop's approved wording in body); n8n_pipelines stays as an unused legacy table
--   n8n_runs      -> automation_runs       (a trigger keeps the mirror row in step, so the run history shows executor 'n8n' runs next to every other)
--   n8n_start_run() / n8n_schedule_pipelines() read automation_pipelines now; n8n_start_run stays THE entry point of the n8n executor.
-- Rule: every automation is OFF until the owner switches it on ("suggested, never auto-enabled"): everything moved or already there for the
-- n8n templates is switched off here.

insert into public.automation_pipelines (workspace_id, template_key, name, module_key, enabled, config, body, body_version, template_version, created_by, created_at, updated_at)
select p.workspace_id, p.template_key,
       case p.template_key
         when 'email-daily-report' then 'Báo cáo cuối ngày qua email'
         when 'email-payment-receipt' then 'Biên nhận thanh toán qua email'
         when 'email-debt-reminder' then 'Nhắc công nợ qua email'
         when 'email-month-ledger' then 'Sổ cái tháng gửi kế toán qua email'
         else p.template_key end,
       case p.template_key when 'email-daily-report' then null else 'accounting' end,
       false,
       p.config - 'body',
       nullif(p.config ->> 'body', ''),
       case when nullif(p.config ->> 'body', '') is null then 0 else 1 end,
       1, p.updated_by, p.created_at, p.updated_at
  from public.n8n_pipelines p
on conflict (workspace_id, template_key) do nothing;

update public.automation_pipelines set enabled = false, updated_at = now() where template_key like 'email-%' and enabled;
update public.n8n_pipelines set enabled = false where enabled;

-- ---------------------------------------------------------------- the n8n executor reads automation_pipelines
create or replace function public.n8n_start_run(
  p_workspace uuid, p_key text, p_data jsonb default '{}'::jsonb, p_dedupe text default null, p_force boolean default false, p_api_base text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_cfg jsonb; v_enabled boolean; v_run uuid := gen_random_uuid(); v_token text; v_base text; v_job uuid;
begin
  if p_key !~ '^[a-z][a-z0-9-]{2,60}$' then raise exception 'bad template key'; end if;
  select a.config || case when a.body is not null then jsonb_build_object('body', a.body) else '{}'::jsonb end, a.enabled
    into v_cfg, v_enabled from public.automation_pipelines a where a.workspace_id = p_workspace and a.template_key = p_key;
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

create or replace function public.n8n_schedule_pipelines()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record; v_local timestamp := now() at time zone 'Asia/Ho_Chi_Minh'; v_at time; v_count int := 0; v_id uuid; v_period text;
begin
  for r in select workspace_id, template_key, config from public.automation_pipelines
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

-- ---------------------------------------------------------------- run history: n8n_runs mirrored into automation_runs
create or replace function public.n8n_runs_mirror()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pipeline uuid;
begin
  select id into v_pipeline from public.automation_pipelines where workspace_id = new.workspace_id and template_key = new.template_key;
  if v_pipeline is null then return new; end if;
  insert into public.automation_runs (pipeline_id, workspace_id, trigger_ref, dedupe_key, payload, status, steps, evidence, error, attempts, run_at, created_at, finished_at)
  values (
    v_pipeline, new.workspace_id, new.template_key, 'n8n:' || new.id, jsonb_build_object('n8n_run_id', new.id, 'dedupe', new.dedupe_key), new.status,
    jsonb_build_array(jsonb_build_object(
      'label', case new.status when 'queued' then 'Đã xếp lượt chạy cho n8n' when 'running' then 'n8n đang chạy' when 'done' then 'n8n đã chạy xong' when 'skipped' then 'Bỏ qua' else 'Lỗi' end,
      'status', case new.status when 'done' then 'done' when 'skipped' then 'skipped' when 'failed' then 'failed' else 'waiting' end,
      'detail', new.summary)),
    new.summary, case when new.status = 'failed' then new.summary end, 1, new.created_at, new.created_at, new.finished_at)
  on conflict (pipeline_id, dedupe_key) do update
    set status = excluded.status, steps = excluded.steps, evidence = excluded.evidence, error = excluded.error, finished_at = excluded.finished_at;
  return new;
end $$;
drop trigger if exists n8n_runs_mirror on public.n8n_runs;
create trigger n8n_runs_mirror after insert or update on public.n8n_runs for each row execute function public.n8n_runs_mirror();
revoke all on function public.n8n_runs_mirror() from public, anon, authenticated;

insert into public.automation_runs (pipeline_id, workspace_id, trigger_ref, dedupe_key, payload, status, steps, evidence, error, attempts, run_at, created_at, finished_at)
select a.id, r.workspace_id, r.template_key, 'n8n:' || r.id, jsonb_build_object('n8n_run_id', r.id, 'dedupe', r.dedupe_key), r.status,
       jsonb_build_array(jsonb_build_object('label', case r.status when 'done' then 'n8n đã chạy xong' when 'skipped' then 'Bỏ qua' when 'failed' then 'Lỗi' else 'Đã xếp lượt chạy cho n8n' end,
                                            'status', case r.status when 'done' then 'done' when 'skipped' then 'skipped' when 'failed' then 'failed' else 'waiting' end, 'detail', r.summary)),
       r.summary, case when r.status = 'failed' then r.summary end, 1, r.created_at, r.created_at, r.finished_at
  from public.n8n_runs r
  join public.automation_pipelines a on a.workspace_id = r.workspace_id and a.template_key = r.template_key
on conflict (pipeline_id, dedupe_key) do nothing;

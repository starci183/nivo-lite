-- What the web app asks of the back end for agents and decisions. The app never calls the back end: it calls one of these functions
-- under the signed-in person's own role. Each one proves the workspace membership (and the role the work needs) from auth.uid(), then
-- puts one job on a pgmq queue through public.job_enqueue (the outbox row and the message in one transaction). The back end job runs
-- the engine as that person and writes the result into the tables the web app reads under RLS.

/** Asks the engine to resume a work item with a person's decision. Any member may ask; the job proves the right to decide again. */
create or replace function public.request_work_decision(
    p_workspace uuid, p_work_item uuid, p_decision text, p_edits jsonb default null, p_note text default null,
    p_basis text default null, p_locale text default 'vi')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_member(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'unknown decision %', p_decision using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.work_items w where w.id = p_work_item and w.workspace_id = p_workspace and w.status = 'waiting_decision'
  ) then
    raise exception 'work item is not waiting for a decision' using errcode = 'P0002';
  end if;
  return public.job_enqueue(
    p_workspace, 'decisions', 'decisions.decide-work',
    jsonb_build_object(
      'workspaceId', p_workspace, 'userId', auth.uid(), 'locale', case when p_locale = 'en' then 'en' else 'vi' end,
      'workItemId', p_work_item, 'decision', p_decision, 'edits', p_edits, 'note', left(p_note, 1000), 'basis', left(p_basis, 1000)),
    'decisions.decide-work:' || p_work_item::text);
end $$;

/** Asks the engine to settle the approval card of a follow-up draft with a person's decision and the draft as edited. */
create or replace function public.request_execution_decision(
    p_workspace uuid, p_execution uuid, p_decision text, p_edited_draft text default null, p_locale text default 'vi')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_member(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'unknown decision %', p_decision using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.executions e where e.id = p_execution and e.workspace_id = p_workspace and e.status = 'pending_approval'
  ) then
    raise exception 'approval card is not pending' using errcode = 'P0002';
  end if;
  return public.job_enqueue(
    p_workspace, 'decisions', 'decisions.decide-execution',
    jsonb_build_object(
      'workspaceId', p_workspace, 'userId', auth.uid(), 'locale', case when p_locale = 'en' then 'en' else 'vi' end,
      'executionId', p_execution, 'decision', p_decision, 'editedDraft', left(p_edited_draft, 10000)),
    'decisions.decide-execution:' || p_execution::text);
end $$;

/** Asks the model for a command card for an owner message of the Office. Owner and manager only. */
create or replace function public.request_office_propose(p_workspace uuid, p_message uuid, p_locale text default 'vi')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_manager(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.messages m where m.id = p_message and m.workspace_id = p_workspace and m.author_kind = 'human'
  ) then
    raise exception 'message not found' using errcode = 'P0002';
  end if;
  return public.job_enqueue(
    p_workspace, 'decisions', 'office.propose-command',
    jsonb_build_object(
      'workspaceId', p_workspace, 'userId', auth.uid(), 'locale', case when p_locale = 'en' then 'en' else 'vi' end,
      'messageId', p_message),
    'office.propose-command:' || p_message::text);
end $$;

/** Sends the command of a confirmed Office card to the receiving agent. Owner and manager only. */
create or replace function public.request_office_confirm(p_workspace uuid, p_candidate uuid, p_locale text default 'vi')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_manager(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.office_command_candidates c where c.id = p_candidate and c.workspace_id = p_workspace and c.status = 'pending'
  ) then
    raise exception 'command card is not pending' using errcode = 'P0002';
  end if;
  return public.job_enqueue(
    p_workspace, 'decisions', 'office.confirm-command',
    jsonb_build_object(
      'workspaceId', p_workspace, 'userId', auth.uid(), 'locale', case when p_locale = 'en' then 'en' else 'vi' end,
      'candidateId', p_candidate),
    'office.confirm-command:' || p_candidate::text);
end $$;

/** Asks for a sync of one agent instance (or of the whole workspace) into its OpenClaw workspace. Owner and manager only. */
create or replace function public.request_agent_sync(p_workspace uuid, p_installation uuid default null, p_force boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject text := coalesce(p_installation::text, 'ws:' || p_workspace::text);
begin
  if auth.uid() is null or not public.is_manager(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_installation is not null and not exists (
    select 1 from public.module_installations i where i.id = p_installation and i.workspace_id = p_workspace
  ) then
    raise exception 'installation not found' using errcode = 'P0002';
  end if;
  return public.job_enqueue(
    p_workspace, 'agents', 'agents.sync',
    jsonb_strip_nulls(jsonb_build_object(
      'workspaceId', p_workspace, 'installationId', p_installation, 'force', coalesce(p_force, false),
      'requestedAt', (extract(epoch from now()) * 1000)::bigint)),
    'agents.sync:' || v_subject || ':' || floor(extract(epoch from now()) / 60)::bigint::text);
end $$;

revoke all on function public.request_work_decision(uuid, uuid, text, jsonb, text, text, text) from public, anon;
revoke all on function public.request_execution_decision(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.request_office_propose(uuid, uuid, text) from public, anon;
revoke all on function public.request_office_confirm(uuid, uuid, text) from public, anon;
revoke all on function public.request_agent_sync(uuid, uuid, boolean) from public, anon;
grant execute on function public.request_work_decision(uuid, uuid, text, jsonb, text, text, text) to authenticated;
grant execute on function public.request_execution_decision(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.request_office_propose(uuid, uuid, text) to authenticated;
grant execute on function public.request_office_confirm(uuid, uuid, text) to authenticated;
grant execute on function public.request_agent_sync(uuid, uuid, boolean) to authenticated;

-- The two pg_cron jobs below belonged to the engine process: the sweep called the Next route /api/engine/sweep (deleted: Next serves no API),
-- and the agent sync queued an engine_jobs row. The back end now runs the agent sync from its own scheduler (agents queue, every 5 minutes).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('engine-sweep', 'engine-openclaw-agent-sync');
  end if;
end $$;

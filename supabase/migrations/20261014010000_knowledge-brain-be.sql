-- The back end side of knowledge and brain (lane L06).
--
-- app_be already holds the table grants and policies of 20261012130100_app-be-grants.sql. A back end capability writes only its own table
-- (BE_SQL_TABLE_OWNER), so the writes that cross tables live in security definer functions the capability calls:
--   record_ai_usage        the usage ledger (ai_usage_events), written by the knowledge metering
--   post_ai_usage_notice   the once-a-month owner notice (ai_usage_notices + a system line in messages)
-- and the database keeps the passages of a source in step with the source itself (module as well as visibility).

-- ---------------------------------------------------------------- usage ledger
create or replace function public.record_ai_usage(
  p_workspace uuid, p_kind text, p_module text, p_model text, p_prompt int, p_completion int, p_cost numeric, p_estimated boolean
) returns void
language sql security definer set search_path = public as $$
  insert into public.ai_usage_events (workspace_id, kind, module, model, prompt_tokens, completion_tokens, cost_usd, estimated)
  values (p_workspace, p_kind, p_module, p_model, greatest(p_prompt, 0), greatest(p_completion, 0), greatest(p_cost, 0), p_estimated);
$$;
revoke all on function public.record_ai_usage(uuid, text, text, text, int, int, numeric, boolean) from public, anon, authenticated;
grant execute on function public.record_ai_usage(uuid, text, text, text, int, int, numeric, boolean) to app_be, service_role;

-- ---------------------------------------------------------------- owner notice, once per month and level
create or replace function public.post_ai_usage_notice(p_workspace uuid, p_period date, p_level text, p_body text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_claimed int;
begin
  insert into public.ai_usage_notices (workspace_id, period, level) values (p_workspace, p_period, p_level)
  on conflict do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    return false;
  end if;
  insert into public.messages (workspace_id, author_kind, author_name, body) values (p_workspace, 'system', 'NIVO', p_body);
  return true;
end;
$$;
revoke all on function public.post_ai_usage_notice(uuid, date, text, text) from public, anon, authenticated;
grant execute on function public.post_ai_usage_notice(uuid, date, text, text) to app_be, service_role;

-- ---------------------------------------------------------------- allowance read by the back end role
grant execute on function public.ai_quota_status(uuid) to app_be;

-- ---------------------------------------------------------------- passages follow their source
create or replace function public.knowledge_chunk_visibility_sync()
returns trigger language plpgsql as $$
begin
  if new.visibility is distinct from old.visibility or new.module is distinct from old.module then
    update public.knowledge_chunks set visibility = new.visibility, module = new.module where source_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists knowledge_sources_visibility_sync on public.knowledge_sources;
create trigger knowledge_sources_visibility_sync after update of visibility, module on public.knowledge_sources
  for each row execute function public.knowledge_chunk_visibility_sync();

-- ---------------------------------------------------------------- the brain finds what a document contributed
-- Withdrawing a changed or deleted document looks facts up by their document evidence (evidence @> '[{"kind":"document","ref":...}]').
create index if not exists brain_facts_evidence on public.brain_facts using gin (evidence jsonb_path_ops);

-- ---------------------------------------------------------------- commands from the Second Brain and Knowledge pages
-- The web app cannot call the back end. A page that needs the back end (the facts logic, the model, Google Drive, the withdrawal of a
-- deleted document's facts) writes a command through brain_command(); a back end job (knowledge queue, job brain.command) carries it
-- out as the person who asked and closes the row with a result or a stored error code, which the page reads through its own policy.
create table if not exists public.brain_commands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  requested_by uuid not null,
  kind text not null check (kind in (
    'fact.save', 'fact.decide', 'fact.keep', 'lesson.save', 'lesson.decide', 'gap.dismiss', 'brain.maintain', 'lessons.mine',
    'source.delete', 'source.reindex', 'source.update', 'knowledge.reembed', 'knowledge.ask', 'drive.linked', 'drive.picked'
  )),
  payload jsonb not null default '{}'::jsonb,       -- a Drive command carries the short-lived Picker token here until the job has run
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists brain_commands_ws on public.brain_commands (workspace_id, created_at desc);
alter table public.brain_commands enable row level security;
drop policy if exists "brain_commands_authenticated_select" on public.brain_commands;
create policy "brain_commands_authenticated_select" on public.brain_commands for select to authenticated using (requested_by = auth.uid());

grant select, insert, update, delete on table public.brain_commands to app_be;
drop policy if exists "brain_commands_app_be_select" on public.brain_commands;
create policy "brain_commands_app_be_select" on public.brain_commands for select to app_be using (workspace_id is not null);
drop policy if exists "brain_commands_app_be_insert" on public.brain_commands;
create policy "brain_commands_app_be_insert" on public.brain_commands for insert to app_be with check (workspace_id is not null);
drop policy if exists "brain_commands_app_be_update" on public.brain_commands;
create policy "brain_commands_app_be_update" on public.brain_commands for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "brain_commands_app_be_delete" on public.brain_commands;
create policy "brain_commands_app_be_delete" on public.brain_commands for delete to app_be using (workspace_id is not null);

/** Writes a command and queues its job in one transaction. A member may ask; the job proves the role the command needs again. */
create or replace function public.brain_command(p_workspace uuid, p_kind text, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_member(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.brain_commands (workspace_id, requested_by, kind, payload)
  values (p_workspace, auth.uid(), p_kind, coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;
  perform public.job_enqueue(p_workspace, 'knowledge', 'brain.command', jsonb_build_object('commandId', v_id, 'workspaceId', p_workspace), 'brain.command:' || v_id);
  return v_id;
end $$;
revoke execute on function public.brain_command(uuid, text, jsonb) from public;
grant execute on function public.brain_command(uuid, text, jsonb) to authenticated;

/** Waits (up to five seconds) for the back end to close a command the caller asked for, and answers how it stands. */
create or replace function public.brain_command_wait(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.brain_commands;
  v_looks int := 0;
begin
  loop
    select * into v_row from public.brain_commands where id = p_id and requested_by = auth.uid();
    if not found then
      raise exception 'not found' using errcode = 'P0002';
    end if;
    exit when v_row.status in ('done', 'failed') or v_looks >= 10;
    perform pg_sleep(0.5);
    v_looks := v_looks + 1;
  end loop;
  return jsonb_build_object('status', v_row.status, 'result', v_row.result, 'errorCode', v_row.error_code);
end $$;
revoke execute on function public.brain_command_wait(uuid) from public;
grant execute on function public.brain_command_wait(uuid) to authenticated;

/* ------------------------------------------------------------------ realtime */

do $$
declare
  v_table text;
begin
  foreach v_table in array array['brain_facts', 'brain_lessons', 'knowledge_gaps', 'brain_extractions'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;

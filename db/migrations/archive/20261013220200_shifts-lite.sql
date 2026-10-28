-- Shifts on the lite back end (be/src/modules/domain/shifts). The web app keeps the plain setup forms (positions, people, pay, coverage, rules and a
-- person's own availability) on RLS; everything with logic goes through a command: a member submits it (shifts_submit proves the membership), a job of
-- the back end runs it as that member through the domain service and writes the answer on the command row, which the member reads through RLS.
-- Every write the back end makes goes through a security invoker function here (schema authority); the table grants of app_be are in app-be-grants.

select pgmq.create('shifts_command');

create table if not exists public.shifts_commands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null,
  input jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'done', 'failed')),
  result jsonb,
  error_code text,
  error_message text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists shifts_commands_workspace_idx on public.shifts_commands (workspace_id, created_at desc);

alter table public.shifts_commands enable row level security;
revoke all on table public.shifts_commands from public, anon, authenticated;
grant select on table public.shifts_commands to authenticated;
grant select, update on table public.shifts_commands to app_be;

drop policy if exists "shifts_commands_authenticated_select" on public.shifts_commands;
create policy "shifts_commands_authenticated_select" on public.shifts_commands for select to authenticated using (public.is_member(workspace_id) and created_by = auth.uid());
drop policy if exists "shifts_commands_app_be_select" on public.shifts_commands;
create policy "shifts_commands_app_be_select" on public.shifts_commands for select to app_be using (workspace_id is not null);
drop policy if exists "shifts_commands_app_be_update" on public.shifts_commands;
create policy "shifts_commands_app_be_update" on public.shifts_commands for update to app_be using (workspace_id is not null) with check (workspace_id is not null);

create or replace function public.shifts_submit(p_workspace uuid, p_kind text, p_input jsonb)
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
  if p_kind not in (
    'propose-week', 'explain-schedule', 'reassign-shift', 'add-draft-shift', 'remove-draft-shift', 'request-publish',
    'request-swap', 'request-leave', 'apply-import'
  ) then
    raise exception 'unknown command %', p_kind using errcode = '22023';
  end if;
  insert into public.shifts_commands (workspace_id, kind, input, created_by)
  values (p_workspace, p_kind, coalesce(p_input, '{}'::jsonb), auth.uid())
  returning id into v_id;
  perform public.job_enqueue(p_workspace, 'shifts_command', 'shifts_command', jsonb_build_object('workspaceId', p_workspace, 'commandId', v_id), 'shifts_command:' || v_id::text);
  return v_id;
end $$;

revoke execute on function public.shifts_submit(uuid, text, jsonb) from public, anon;
grant execute on function public.shifts_submit(uuid, text, jsonb) to authenticated;

create or replace function public.shifts_command_finish(p_id uuid, p_status text, p_result jsonb, p_code text, p_message text)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.shifts_commands
  set status = p_status, result = p_result, error_code = p_code, error_message = p_message, finished_at = now()
  where id = p_id and status = 'queued';
end $$;

revoke all on function public.shifts_command_finish(uuid, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.shifts_command_finish(uuid, text, jsonb, text, text) to app_be;

-- ---------------------------------------------------------------- schedules and shifts

-- Saves a new draft version of a week; older drafts of that week become superseded. Answers the new schedule id.
create or replace function public.shifts_save_schedule(p_ws uuid, p_week date, p_cost bigint, p_summary jsonb, p_evidence jsonb, p_ms int, p_by text)
returns uuid language plpgsql set search_path = public as $fn$
declare
  v_version int;
  v_id uuid;
begin
  select coalesce(max(version), 0) into v_version from public.shifts_schedules where workspace_id = p_ws and week_start = p_week;
  update public.shifts_schedules set status = 'superseded' where workspace_id = p_ws and week_start = p_week and status = 'draft';
  insert into public.shifts_schedules (workspace_id, week_start, version, status, source, cost_vnd, summary, evidence, solver_ms, created_by)
  values (p_ws, p_week, v_version + 1, 'draft', 'solver', p_cost, coalesce(p_summary, '{}'::jsonb), coalesce(p_evidence, '{}'::jsonb), p_ms, p_by)
  returning id into v_id;
  return v_id;
end
$fn$;
revoke all on function public.shifts_save_schedule(uuid, date, bigint, jsonb, jsonb, int, text) from public, anon, authenticated;
grant execute on function public.shifts_save_schedule(uuid, date, bigint, jsonb, jsonb, int, text) to app_be;

-- Adds shifts to a schedule from parallel arrays (a null person is an open shift). Answers how many were added.
create or replace function public.shifts_add_shifts(p_ws uuid, p_schedule uuid, p_dates date[], p_starts time[], p_ends time[], p_positions uuid[], p_staff uuid[], p_source text)
returns int language plpgsql set search_path = public as $fn$
declare
  v_count int;
begin
  insert into public.shifts_shifts (workspace_id, schedule_id, shift_date, start_time, end_time, position_id, staff_id, status, source)
  select p_ws, p_schedule, d, s, e, pos, st, 'draft', p_source
  from unnest(p_dates, p_starts, p_ends, p_positions, p_staff) as t(d, s, e, pos, st);
  get diagnostics v_count = row_count;
  return v_count;
end
$fn$;
revoke all on function public.shifts_add_shifts(uuid, uuid, date[], time[], time[], uuid[], uuid[], text) from public, anon, authenticated;
grant execute on function public.shifts_add_shifts(uuid, uuid, date[], time[], time[], uuid[], uuid[], text) to app_be;

create or replace function public.shifts_set_explanation(p_ws uuid, p_schedule uuid, p_text text, p_evidence jsonb)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.shifts_schedules set explanation = p_text, evidence = p_evidence where id = p_schedule and workspace_id = p_ws;
end
$fn$;
revoke all on function public.shifts_set_explanation(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.shifts_set_explanation(uuid, uuid, text, jsonb) to app_be;

create or replace function public.shifts_reassign(p_ws uuid, p_shift uuid, p_staff uuid)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.shifts_shifts set staff_id = p_staff, source = 'manual' where id = p_shift and workspace_id = p_ws;
end
$fn$;
revoke all on function public.shifts_reassign(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.shifts_reassign(uuid, uuid, uuid) to app_be;

create or replace function public.shifts_remove_shift(p_ws uuid, p_shift uuid)
returns void language plpgsql set search_path = public as $fn$
begin
  delete from public.shifts_shifts where id = p_shift and workspace_id = p_ws and status = 'draft';
end
$fn$;
revoke all on function public.shifts_remove_shift(uuid, uuid) from public, anon, authenticated;
grant execute on function public.shifts_remove_shift(uuid, uuid) to app_be;

create or replace function public.shifts_link_schedule(p_ws uuid, p_schedule uuid, p_work uuid)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.shifts_schedules set work_item_id = p_work where id = p_schedule and workspace_id = p_ws;
end
$fn$;
revoke all on function public.shifts_link_schedule(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.shifts_link_schedule(uuid, uuid, uuid) to app_be;

-- Publishes a draft: the older published version of the week is superseded and its shifts stop counting; answers the shifts now published.
create or replace function public.shifts_publish(p_ws uuid, p_schedule uuid, p_evidence jsonb, p_work uuid)
returns int language plpgsql set search_path = public as $fn$
declare
  v_week date;
  v_count int;
begin
  select week_start into v_week from public.shifts_schedules where id = p_schedule and workspace_id = p_ws;
  update public.shifts_shifts set status = 'cancelled'
  where workspace_id = p_ws and status in ('published', 'swapped')
    and schedule_id in (select id from public.shifts_schedules where workspace_id = p_ws and week_start = v_week and status = 'published');
  update public.shifts_schedules set status = 'superseded' where workspace_id = p_ws and week_start = v_week and status = 'published';
  update public.shifts_shifts set status = 'published' where schedule_id = p_schedule and workspace_id = p_ws and status = 'draft';
  update public.shifts_schedules set status = 'published', published_at = now(), work_item_id = p_work, evidence = p_evidence where id = p_schedule and workspace_id = p_ws;
  select count(*) into v_count from public.shifts_shifts where schedule_id = p_schedule and status = 'published';
  return v_count;
end
$fn$;
revoke all on function public.shifts_publish(uuid, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.shifts_publish(uuid, uuid, jsonb, uuid) to app_be;

-- ---------------------------------------------------------------- requests

create or replace function public.shifts_create_leave(p_ws uuid, p_staff uuid, p_from date, p_to date, p_reason text)
returns uuid language plpgsql set search_path = public as $fn$
declare v_id uuid;
begin
  insert into public.shifts_leave_requests (workspace_id, staff_id, from_date, to_date, reason) values (p_ws, p_staff, p_from, p_to, p_reason) returning id into v_id;
  return v_id;
end
$fn$;
revoke all on function public.shifts_create_leave(uuid, uuid, date, date, text) from public, anon, authenticated;
grant execute on function public.shifts_create_leave(uuid, uuid, date, date, text) to app_be;

create or replace function public.shifts_create_swap(p_ws uuid, p_kind text, p_shift uuid, p_from uuid, p_to uuid, p_reason text)
returns uuid language plpgsql set search_path = public as $fn$
declare v_id uuid;
begin
  insert into public.shifts_swap_requests (workspace_id, kind, shift_id, from_staff_id, to_staff_id, reason) values (p_ws, p_kind, p_shift, p_from, p_to, p_reason) returning id into v_id;
  return v_id;
end
$fn$;
revoke all on function public.shifts_create_swap(uuid, text, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.shifts_create_swap(uuid, text, uuid, uuid, uuid, text) to app_be;

create or replace function public.shifts_link_swap(p_ws uuid, p_swap uuid, p_checks jsonb, p_work uuid)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.shifts_swap_requests set checks = coalesce(p_checks, '[]'::jsonb), work_item_id = p_work where id = p_swap and workspace_id = p_ws;
end
$fn$;
revoke all on function public.shifts_link_swap(uuid, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.shifts_link_swap(uuid, uuid, jsonb, uuid) to app_be;

create or replace function public.shifts_link_leave(p_ws uuid, p_leave uuid, p_work uuid)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.shifts_leave_requests set work_item_id = p_work where id = p_leave and workspace_id = p_ws;
end
$fn$;
revoke all on function public.shifts_link_leave(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.shifts_link_leave(uuid, uuid, uuid) to app_be;

-- Settles a swap request once: approved moves the shift to the new person, declined leaves it.
create or replace function public.shifts_decide_swap(p_ws uuid, p_swap uuid, p_status text, p_by text, p_checks jsonb, p_work uuid)
returns boolean language plpgsql set search_path = public as $fn$
declare
  v_shift uuid;
  v_to uuid;
  v_moved int;
begin
  update public.shifts_swap_requests
  set status = p_status, decided_by = p_by, decided_at = now(), checks = coalesce(p_checks, checks), work_item_id = coalesce(p_work, work_item_id)
  where id = p_swap and workspace_id = p_ws and status = 'pending'
  returning shift_id, to_staff_id into v_shift, v_to;
  get diagnostics v_moved = row_count;
  if v_moved = 0 then return false; end if;
  if p_status = 'approved' then
    update public.shifts_shifts set staff_id = v_to, status = 'swapped', source = 'swap' where id = v_shift and workspace_id = p_ws;
  end if;
  return true;
end
$fn$;
revoke all on function public.shifts_decide_swap(uuid, uuid, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.shifts_decide_swap(uuid, uuid, text, text, jsonb, uuid) to app_be;

-- Settles a leave request once; approved turns the person's shifts in the range into open shifts and answers their ids.
create or replace function public.shifts_decide_leave(p_ws uuid, p_leave uuid, p_status text, p_by text, p_work uuid, p_note text)
returns uuid[] language plpgsql set search_path = public as $fn$
declare
  v_staff uuid;
  v_from date;
  v_to date;
  v_moved int;
  v_ids uuid[] := '{}';
begin
  update public.shifts_leave_requests
  set status = p_status, decided_by = p_by, decided_at = now(), work_item_id = coalesce(p_work, work_item_id)
  where id = p_leave and workspace_id = p_ws and status = 'pending'
  returning staff_id, from_date, to_date into v_staff, v_from, v_to;
  get diagnostics v_moved = row_count;
  if v_moved = 0 or p_status <> 'approved' then return v_ids; end if;
  select coalesce(array_agg(id), '{}') into v_ids from public.shifts_shifts
  where workspace_id = p_ws and staff_id = v_staff and shift_date between v_from and v_to and status in ('draft', 'published', 'swapped');
  update public.shifts_shifts set staff_id = null, source = 'manual', note = p_note where id = any(v_ids);
  return v_ids;
end
$fn$;
revoke all on function public.shifts_decide_leave(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.shifts_decide_leave(uuid, uuid, text, text, uuid, text) to app_be;

-- ---------------------------------------------------------------- quick import and evidence

-- Adds positions, people (with pay) and coverage from the quick import: p_positions [{name,color}], p_staff [{name,positions[],wage,maxWeek}], p_blocks [{weekday,start,end,position,min,ideal,peak}].
create or replace function public.shifts_import_apply(p_ws uuid, p_positions jsonb, p_staff jsonb, p_blocks jsonb)
returns jsonb language plpgsql set search_path = public as $fn$
declare
  r jsonb;
  v_staff uuid;
  v_positions int := 0;
  v_people int := 0;
  v_blocks int := 0;
  v_ids uuid[];
begin
  for r in select * from jsonb_array_elements(coalesce(p_positions, '[]'::jsonb)) loop
    insert into public.shifts_positions (workspace_id, name, color) values (p_ws, r->>'name', coalesce(r->>'color', '#2f6fed')) on conflict (workspace_id, name) do nothing;
    if found then v_positions := v_positions + 1; end if;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_staff, '[]'::jsonb)) loop
    select coalesce(array_agg(id), '{}') into v_ids from public.shifts_positions
    where workspace_id = p_ws and name in (select jsonb_array_elements_text(r->'positions'));
    insert into public.shifts_staff (workspace_id, name, position_ids, max_hours_week)
    values (p_ws, r->>'name', v_ids, coalesce((r->>'maxWeek')::numeric, 48)) returning id into v_staff;
    insert into public.shifts_staff_pay (staff_id, workspace_id, hourly_wage_vnd) values (v_staff, p_ws, coalesce((r->>'wage')::int, 0));
    v_people := v_people + 1;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) loop
    insert into public.shifts_coverage (workspace_id, weekday, start_time, end_time, position_id, min_staff, ideal_staff, is_peak)
    select p_ws, (r->>'weekday')::smallint, (r->>'start')::time, (r->>'end')::time, id, (r->>'min')::int, (r->>'ideal')::int, coalesce((r->>'peak')::boolean, false)
    from public.shifts_positions where workspace_id = p_ws and name = r->>'position';
    if found then v_blocks := v_blocks + 1; end if;
  end loop;
  return jsonb_build_object('positions', v_positions, 'staff', v_people, 'blocks', v_blocks);
end
$fn$;
revoke all on function public.shifts_import_apply(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.shifts_import_apply(uuid, jsonb, jsonb, jsonb) to app_be;

create or replace function public.shifts_record_notification(p_ws uuid, p_staff uuid, p_schedule uuid, p_shift uuid, p_kind text, p_channel text, p_status text, p_body text)
returns void language plpgsql set search_path = public as $fn$
begin
  insert into public.shifts_notifications (workspace_id, staff_id, schedule_id, shift_id, kind, channel, status, body)
  values (p_ws, p_staff, p_schedule, p_shift, p_kind, p_channel, p_status, left(coalesce(p_body, ''), 4000));
end
$fn$;
revoke all on function public.shifts_record_notification(uuid, uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.shifts_record_notification(uuid, uuid, uuid, uuid, text, text, text, text) to app_be;

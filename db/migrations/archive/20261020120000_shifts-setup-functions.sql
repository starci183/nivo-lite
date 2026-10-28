-- Shifts setup writes for the api: positions, people and pay, coverage, rules, availability and check-in. Each one is a security
-- invoker function granted to app_be only, like every other write the back end makes.

-- Makes or renames a position; a null id inserts (a repeated name only recolours), a given id renames. Answers its id, null when the id is not of the workspace.
create or replace function public.shifts_save_position(p_ws uuid, p_id uuid, p_name text, p_color text)
returns uuid language plpgsql set search_path = public as $fn$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into public.shifts_positions (workspace_id, name, color)
    values (p_ws, p_name, coalesce(p_color, '#2f6fed'))
    on conflict (workspace_id, name) do update set color = excluded.color
    returning id into v_id;
  else
    update public.shifts_positions set name = p_name, color = coalesce(p_color, color)
    where workspace_id = p_ws and id = p_id
    returning id into v_id;
  end if;
  return v_id;
end
$fn$;
revoke all on function public.shifts_save_position(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.shifts_save_position(uuid, uuid, text, text) to app_be;

-- Retires a position; its coverage rows stay but stop matching.
create or replace function public.shifts_remove_position(p_ws uuid, p_id uuid)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.shifts_positions set active = false where workspace_id = p_ws and id = p_id;
end
$fn$;
revoke all on function public.shifts_remove_position(uuid, uuid) from public, anon, authenticated;
grant execute on function public.shifts_remove_position(uuid, uuid) to app_be;

-- Makes or updates one person's shifts profile from a row json (name, staffRowId, phone, telegramChatId, zaloUserId,
-- positionIds, maxWeek, maxDay, minRest, active). Answers its id, null when the id is not of the workspace.
create or replace function public.shifts_save_staff(p_ws uuid, p_id uuid, p_row jsonb)
returns uuid language plpgsql set search_path = public as $fn$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into public.shifts_staff (workspace_id, name, staff_id, phone, telegram_chat_id, zalo_user_id, position_ids, max_hours_week, max_hours_day, min_rest_hours, active)
    values (p_ws,
      p_row->>'name',
      nullif(p_row->>'staffRowId', '')::uuid,
      nullif(p_row->>'phone', ''),
      nullif(p_row->>'telegramChatId', ''),
      nullif(p_row->>'zaloUserId', ''),
      coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_row->'positionIds') x), '{}'::uuid[]),
      coalesce(nullif(p_row->>'maxWeek', '')::numeric, 48),
      coalesce(nullif(p_row->>'maxDay', '')::numeric, 10),
      coalesce(nullif(p_row->>'minRest', '')::numeric, 10),
      coalesce((p_row->>'active')::boolean, true))
    returning id into v_id;
  else
    update public.shifts_staff
    set name = p_row->>'name',
        staff_id = nullif(p_row->>'staffRowId', '')::uuid,
        phone = nullif(p_row->>'phone', ''),
        telegram_chat_id = nullif(p_row->>'telegramChatId', ''),
        zalo_user_id = nullif(p_row->>'zaloUserId', ''),
        position_ids = coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_row->'positionIds') x), '{}'::uuid[]),
        max_hours_week = coalesce(nullif(p_row->>'maxWeek', '')::numeric, max_hours_week),
        max_hours_day = coalesce(nullif(p_row->>'maxDay', '')::numeric, max_hours_day),
        min_rest_hours = coalesce(nullif(p_row->>'minRest', '')::numeric, min_rest_hours),
        active = coalesce((p_row->>'active')::boolean, true)
    where workspace_id = p_ws and id = p_id
    returning id into v_id;
  end if;
  return v_id;
end
$fn$;
revoke all on function public.shifts_save_staff(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.shifts_save_staff(uuid, uuid, jsonb) to app_be;

-- Saves the hourly wage of a person.
create or replace function public.shifts_save_pay(p_ws uuid, p_staff uuid, p_wage int)
returns void language plpgsql set search_path = public as $fn$
begin
  insert into public.shifts_staff_pay (staff_id, workspace_id, hourly_wage_vnd, updated_at)
  values (p_staff, p_ws, p_wage, now())
  on conflict (staff_id) do update set hourly_wage_vnd = excluded.hourly_wage_vnd, updated_at = excluded.updated_at;
end
$fn$;
revoke all on function public.shifts_save_pay(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.shifts_save_pay(uuid, uuid, int) to app_be;

-- Updates one coverage block, or inserts one per weekday given when the id is null.
create or replace function public.shifts_save_coverage(p_ws uuid, p_id uuid, p_weekdays smallint[], p_start time, p_end time, p_position uuid, p_min int, p_ideal int, p_peak boolean)
returns void language plpgsql set search_path = public as $fn$
begin
  if p_id is null then
    insert into public.shifts_coverage (workspace_id, weekday, start_time, end_time, position_id, min_staff, ideal_staff, is_peak)
    select p_ws, day, p_start, p_end, p_position, p_min, p_ideal, p_peak
    from unnest(p_weekdays) as day;
  else
    update public.shifts_coverage
    set weekday = p_weekdays[1], start_time = p_start, end_time = p_end, position_id = p_position,
        min_staff = p_min, ideal_staff = p_ideal, is_peak = p_peak
    where workspace_id = p_ws and id = p_id;
  end if;
end
$fn$;
revoke all on function public.shifts_save_coverage(uuid, uuid, smallint[], time, time, uuid, int, int, boolean) from public, anon, authenticated;
grant execute on function public.shifts_save_coverage(uuid, uuid, smallint[], time, time, uuid, int, int, boolean) to app_be;

-- Removes a coverage block.
create or replace function public.shifts_remove_coverage(p_ws uuid, p_id uuid)
returns void language plpgsql set search_path = public as $fn$
begin
  delete from public.shifts_coverage where workspace_id = p_ws and id = p_id;
end
$fn$;
revoke all on function public.shifts_remove_coverage(uuid, uuid) from public, anon, authenticated;
grant execute on function public.shifts_remove_coverage(uuid, uuid) to app_be;

-- Saves the rules and the opening hours of the shop.
create or replace function public.shifts_save_settings(p_ws uuid, p_opening jsonb, p_swap int, p_leave int, p_remind int, p_noshow int, p_overtime numeric)
returns void language plpgsql set search_path = public as $fn$
begin
  insert into public.shifts_settings (workspace_id, opening_hours, swap_notice_hours, leave_notice_days, remind_minutes, noshow_minutes, overtime_hours_week, updated_at)
  values (p_ws, p_opening, p_swap, p_leave, p_remind, p_noshow, p_overtime, now())
  on conflict (workspace_id) do update set
    opening_hours = excluded.opening_hours,
    swap_notice_hours = excluded.swap_notice_hours,
    leave_notice_days = excluded.leave_notice_days,
    remind_minutes = excluded.remind_minutes,
    noshow_minutes = excluded.noshow_minutes,
    overtime_hours_week = excluded.overtime_hours_week,
    updated_at = excluded.updated_at;
end
$fn$;
revoke all on function public.shifts_save_settings(uuid, jsonb, int, int, int, int, numeric) from public, anon, authenticated;
grant execute on function public.shifts_save_settings(uuid, jsonb, int, int, int, int, numeric) to app_be;

-- Adds an availability statement and answers its id. A manager's statement arrives 'approved' with their name; a member's 'pending'.
create or replace function public.shifts_add_availability(p_ws uuid, p_staff uuid, p_weekday smallint, p_date date, p_start time, p_end time, p_available boolean, p_note text, p_status text, p_decider text)
returns uuid language plpgsql set search_path = public as $fn$
declare
  v_id uuid;
begin
  insert into public.shifts_availability (workspace_id, staff_id, weekday, shift_date, start_time, end_time, available, note, status, decided_by)
  values (p_ws, p_staff, p_weekday, p_date, p_start, p_end, p_available, coalesce(p_note, ''), p_status, p_decider)
  returning id into v_id;
  return v_id;
end
$fn$;
revoke all on function public.shifts_add_availability(uuid, uuid, smallint, date, time, time, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.shifts_add_availability(uuid, uuid, smallint, date, time, time, boolean, text, text, text) to app_be;

-- Removes an availability statement.
create or replace function public.shifts_remove_availability(p_ws uuid, p_id uuid)
returns void language plpgsql set search_path = public as $fn$
begin
  delete from public.shifts_availability where workspace_id = p_ws and id = p_id;
end
$fn$;
revoke all on function public.shifts_remove_availability(uuid, uuid) from public, anon, authenticated;
grant execute on function public.shifts_remove_availability(uuid, uuid) to app_be;

-- Approves or declines a pending availability statement.
create or replace function public.shifts_decide_availability(p_ws uuid, p_id uuid, p_status text, p_decider text)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.shifts_availability set status = p_status, decided_by = p_decider
  where workspace_id = p_ws and id = p_id and status = 'pending';
end
$fn$;
revoke all on function public.shifts_decide_availability(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.shifts_decide_availability(uuid, uuid, text, text) to app_be;

-- Records a check-in once and answers when it happened; a second check-in answers the first time.
create or replace function public.shifts_check_in(p_ws uuid, p_shift uuid, p_staff uuid)
returns timestamptz language plpgsql set search_path = public as $fn$
declare
  v_at timestamptz;
begin
  insert into public.shifts_attendance (workspace_id, shift_id, staff_id)
  values (p_ws, p_shift, p_staff)
  on conflict (shift_id, staff_id) do nothing
  returning checked_in_at into v_at;
  if v_at is null then
    select checked_in_at into v_at from public.shifts_attendance where shift_id = p_shift and staff_id = p_staff;
  end if;
  return v_at;
end
$fn$;
revoke all on function public.shifts_check_in(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.shifts_check_in(uuid, uuid, uuid) to app_be;

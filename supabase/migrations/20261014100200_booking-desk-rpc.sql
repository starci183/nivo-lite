-- The owner's "add booking" and "move booking" on the calendar. The web app writes through row level security and never calls the back end, but a
-- booking is only safe to write under the lock of booking_reserve / booking_relocate (they refuse a double booking), which RLS cannot express. So the
-- two commands are definer functions that prove the caller manages the workspace (auth.uid() through is_manager) and then call the guards.
-- Answers are { ok, reason, id }; the reason is a catalog key suffix (reason_<reason> of workbenchBooking), the same set the back end desk uses.

create or replace function public.desk_booking_add(
  p_workspace uuid, p_service uuid, p_date text, p_time text, p_name text, p_phone text, p_party int, p_note text,
  p_force boolean default false, p_resource uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_svc record;
  v_tz text;
  v_pct int;
  v_start timestamptz;
  v_check record;
  v_res uuid;
  v_id uuid;
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_phone text;
  v_party int := least(20, greatest(1, coalesce(p_party, 1)));
  v_deposit bigint := 0;
begin
  if auth.uid() is null or not public.is_manager(p_workspace) then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  if p_service is null then
    return jsonb_build_object('ok', false, 'reason', 'service_required', 'id', null);
  end if;
  if v_name = '' then
    return jsonb_build_object('ok', false, 'reason', 'name_required', 'id', null);
  end if;
  if p_date is null or p_time is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' or p_time !~ '^\d{2}:\d{2}$' then
    return jsonb_build_object('ok', false, 'reason', 'datetime_invalid', 'id', null);
  end if;
  select s.timezone, s.deposit_pct into v_tz, v_pct from public.booking_settings s where s.workspace_id = p_workspace;
  select v.id, v.price_vnd, v.duration_min, v.buffer_min, v.resource_kind into v_svc from public.booking_services v where v.id = p_service and v.workspace_id = p_workspace;
  if v_svc.id is null or v_tz is null then
    return jsonb_build_object('ok', false, 'reason', 'service_not_found', 'id', null);
  end if;
  begin
    v_start := (p_date || ' ' || p_time)::timestamp at time zone v_tz;
  exception when others then
    return jsonb_build_object('ok', false, 'reason', 'datetime_invalid', 'id', null);
  end;
  if v_digits = '' then
    v_phone := null;
  elsif left(v_digits, 1) = '0' then
    v_phone := '84' || substr(v_digits, 2);
  elsif left(v_digits, 2) <> '84' and length(v_digits) = 9 then
    v_phone := '84' || v_digits;
  else
    v_phone := v_digits;
  end if;
  -- the owner is not held to the lead time or the advance limit
  select * into v_check from public.booking_check_slot(p_workspace, p_service, v_start, v_party, 0, 365);
  if p_resource is null and not v_check.ok and not coalesce(p_force, false) then
    return jsonb_build_object('ok', false, 'id', null,
      'reason', case when v_check.why in ('closed', 'full', 'no_resource') then v_check.why else 'datetime_invalid' end);
  end if;
  v_res := p_resource;
  if v_res is null and v_check.ok then
    v_res := v_check.resource;
  end if;
  if v_res is null then
    select r.id into v_res from public.booking_resources r
     where r.workspace_id = p_workspace and r.active
       and (v_svc.resource_kind is null or r.kind = v_svc.resource_kind)
     order by r.sort_order, r.created_at limit 1;
  end if;
  if v_res is null then
    return jsonb_build_object('ok', false, 'reason', 'no_resource', 'id', null);
  end if;
  if v_svc.price_vnd is not null and v_svc.price_vnd > 0 and v_pct > 0 then
    v_deposit := round(v_svc.price_vnd * v_pct / 100.0)::bigint;
  end if;
  begin
    v_id := public.booking_reserve(
      jsonb_build_object(
        'workspace_id', p_workspace, 'customer_name', v_name, 'customer_phone', v_phone, 'service_id', p_service, 'resource_id', v_res,
        'start_at', v_start, 'end_at', v_start + make_interval(mins => v_svc.duration_min),
        'block_end_at', v_start + make_interval(mins => v_svc.duration_min + v_svc.buffer_min),
        'party_size', v_party, 'status', 'confirmed', 'holds_slot', true, 'source_channel', 'manual', 'price_vnd', v_svc.price_vnd,
        'deposit_vnd', v_deposit, 'deposit_status', case when v_deposit > 0 then 'due' else 'none' end,
        'note', left(btrim(coalesce(p_note, '')), 400), 'conflict_note', ''
      ),
      coalesce(p_force, false)
    );
  exception when raise_exception then
    return jsonb_build_object('ok', false, 'reason', 'resource_not_found', 'id', null);
  end;
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'taken', 'id', null);
  end if;
  return jsonb_build_object('ok', true, 'reason', null, 'id', v_id);
end $$;

create or replace function public.desk_booking_move(p_workspace uuid, p_booking uuid, p_start timestamptz, p_force boolean default false, p_resource uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row record;
  v_res uuid;
  v_end timestamptz;
  v_moved boolean;
begin
  if auth.uid() is null or not public.is_manager(p_workspace) then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  if p_start is null then
    return jsonb_build_object('ok', false, 'reason', 'datetime_invalid', 'id', null);
  end if;
  select b.id, b.resource_id, b.status, v.duration_min, v.buffer_min into v_row
    from public.bookings b join public.booking_services v on v.id = b.service_id
   where b.workspace_id = p_workspace and b.id = p_booking
   for update of b;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_movable', 'id', null);
  end if;
  if v_row.status not in ('requested', 'confirmed', 'rescheduled') then
    return jsonb_build_object('ok', false, 'reason', 'not_movable', 'id', null);
  end if;
  v_res := coalesce(p_resource, v_row.resource_id);
  v_end := p_start + make_interval(mins => v_row.duration_min);
  begin
    v_moved := public.booking_relocate(p_booking, v_res, p_start, v_end, v_end + make_interval(mins => v_row.buffer_min), coalesce(p_force, false));
  exception when raise_exception then
    return jsonb_build_object('ok', false, 'reason', 'resource_not_found', 'id', null);
  end;
  if not v_moved then
    return jsonb_build_object('ok', false, 'reason', 'taken', 'id', null);
  end if;
  return jsonb_build_object('ok', true, 'reason', null, 'id', p_booking);
end $$;

revoke all on function public.desk_booking_add(uuid, uuid, text, text, text, text, int, text, boolean, uuid) from public, anon;
revoke all on function public.desk_booking_move(uuid, uuid, timestamptz, boolean, uuid) from public, anon;
grant execute on function public.desk_booking_add(uuid, uuid, text, text, text, text, int, text, boolean, uuid) to authenticated;
grant execute on function public.desk_booking_move(uuid, uuid, timestamptz, boolean, uuid) to authenticated;

-- The booking availability planner in SQL. The public booking page (/b/<slug>) and the owner's "add booking" / "move booking" cannot call the back end
-- (the web app never does), so the free times are computed here, next to the data and the double-booking guard (booking_reserve / booking_relocate).
-- It mirrors the TypeScript policy in be/src/modules/domain/bookings/policies/availability.policy.ts:
--   * windows of a resource on a local date: its own exception, else the business exception, else its weekly hours; approved staff leave closes the day;
--   * a start is free when the resource still has room for the whole party over duration + buffer (booking_peak_load), on the slot step, inside the
--     window, after the minimum lead and before the advance limit.
-- Internal functions: nobody calls them over the API, only the definer functions of the next migrations.

create or replace function public.booking_windows(p_resource uuid, p_ws uuid, p_date date, p_tz text)
returns table (w_start timestamptz, w_end timestamptz)
language plpgsql stable set search_path = public as $$
declare
  v_own boolean;
  v_closed boolean;
  v_open int;
begin
  if exists (
    select 1
      from public.booking_resources r
      join public.shifts_staff p on p.staff_id = r.staff_id and p.workspace_id = r.workspace_id
      join public.shifts_leave_requests l on l.staff_id = p.id and l.workspace_id = r.workspace_id
     where r.id = p_resource and r.workspace_id = p_ws and l.status = 'approved' and l.from_date <= p_date and l.to_date >= p_date
  ) then
    return;
  end if;
  v_own := exists (select 1 from public.booking_exceptions e where e.workspace_id = p_ws and e.on_date = p_date and e.resource_id = p_resource);
  select coalesce(bool_or(e.closed), false), count(*) filter (where e.start_time is not null and e.end_time is not null)
    into v_closed, v_open
    from public.booking_exceptions e
   where e.workspace_id = p_ws and e.on_date = p_date
     and (case when v_own then e.resource_id = p_resource else e.resource_id is null end);
  if v_closed then
    return;
  end if;
  if v_open > 0 then
    return query
      select ((p_date + e.start_time)::timestamp at time zone p_tz), ((p_date + e.end_time)::timestamp at time zone p_tz)
        from public.booking_exceptions e
       where e.workspace_id = p_ws and e.on_date = p_date and e.start_time is not null and e.end_time is not null
         and (case when v_own then e.resource_id = p_resource else e.resource_id is null end)
       order by 1;
  else
    return query
      select ((p_date + h.start_time)::timestamp at time zone p_tz), ((p_date + h.end_time)::timestamp at time zone p_tz)
        from public.booking_hours h
       where h.workspace_id = p_ws and h.resource_id = p_resource and h.weekday = extract(isodow from p_date)::int
       order by 1;
  end if;
end $$;

-- Every free start of a service between two instants, earliest first. p_resource pins one resource, p_exclude leaves one booking out (a move),
-- p_lead_min / p_max_days replace the policy of the shop (the owner is not held to the lead time or the advance limit).
create or replace function public.booking_free_slots(
  p_ws uuid, p_service uuid, p_from timestamptz, p_to timestamptz, p_party int,
  p_resource uuid default null, p_exclude uuid default null, p_lead_min int default null, p_max_days int default null
)
returns table (s_start timestamptz, s_end timestamptz, s_block_end timestamptz, s_resource uuid, s_ratio numeric)
language plpgsql stable set search_path = public as $$
declare
  v_tz text;
  v_step int;
  v_lead int;
  v_days int;
  v_dur interval;
  v_buf interval;
  v_kind text;
  v_active boolean;
  v_from timestamptz;
  v_to timestamptz;
  v_party int := greatest(1, coalesce(p_party, 1));
begin
  select s.timezone, s.slot_step_min, s.min_lead_min, s.max_advance_days into v_tz, v_step, v_lead, v_days
    from public.booking_settings s where s.workspace_id = p_ws;
  if v_tz is null then
    return;
  end if;
  select make_interval(mins => v.duration_min), make_interval(mins => v.buffer_min), v.resource_kind, v.active into v_dur, v_buf, v_kind, v_active
    from public.booking_services v where v.id = p_service and v.workspace_id = p_ws;
  if v_active is not true then
    return;
  end if;
  v_lead := coalesce(p_lead_min, v_lead);
  v_days := coalesce(p_max_days, v_days);
  v_from := greatest(p_from, now() + make_interval(mins => v_lead));
  v_to := least(p_to, now() + make_interval(days => v_days));
  if v_to <= v_from then
    return;
  end if;
  v_step := greatest(5, v_step);
  return query
    with res as (
      select r.id as rid, r.capacity as cap
        from public.booking_resources r
       where r.workspace_id = p_ws and r.active and r.capacity >= v_party
         and (p_resource is null or r.id = p_resource)
         and (v_kind is null or r.kind = v_kind)
    ),
    days as (
      select d::date as day
        from generate_series(((v_from at time zone v_tz)::date - 1)::timestamp, ((v_to at time zone v_tz)::date + 1)::timestamp, interval '1 day') d
    ),
    wins as (
      select res.rid, w.w_start, w.w_end
        from res cross join days cross join lateral public.booking_windows(res.rid, p_ws, days.day, v_tz) w
    ),
    cand as (
      select wins.rid, gs as st
        from wins cross join lateral generate_series(wins.w_start, wins.w_end - v_dur, make_interval(mins => v_step)) gs
       where gs >= v_from and gs < v_to
    )
    select c.st, c.st + v_dur, c.st + v_dur + v_buf, c.rid, (l.load::numeric / r.cap)
      from cand c
      join res r on r.rid = c.rid
     cross join lateral (select public.booking_peak_load(c.rid, c.st, c.st + v_dur + v_buf, p_exclude) as load) l
     where l.load + v_party <= r.cap
     order by c.st, c.rid;
end $$;

-- One exact start: the least loaded free resource (then the first in order), or the reason there is none:
-- no_service | no_resource | too_soon | too_far | full | closed.
create or replace function public.booking_check_slot(
  p_ws uuid, p_service uuid, p_start timestamptz, p_party int, p_lead_min int default null, p_max_days int default null
)
returns table (ok boolean, resource uuid, why text)
language plpgsql stable set search_path = public as $$
declare
  v_tz text;
  v_lead int;
  v_days int;
  v_dur int;
  v_kind text;
  v_active boolean;
  v_found uuid;
  v_eligible int;
  v_date date;
  v_opened boolean;
begin
  select s.timezone, s.min_lead_min, s.max_advance_days into v_tz, v_lead, v_days from public.booking_settings s where s.workspace_id = p_ws;
  select v.duration_min, v.resource_kind, v.active into v_dur, v_kind, v_active from public.booking_services v where v.id = p_service and v.workspace_id = p_ws;
  if v_tz is null or v_active is not true then
    return query select false, null::uuid, 'no_service'::text;
    return;
  end if;
  v_lead := coalesce(p_lead_min, v_lead);
  v_days := coalesce(p_max_days, v_days);
  select count(*) into v_eligible from public.booking_resources r where r.workspace_id = p_ws and r.active and (v_kind is null or r.kind = v_kind);
  if v_eligible = 0 then
    return query select false, null::uuid, 'no_resource'::text;
    return;
  end if;
  if p_start < now() + make_interval(mins => v_lead) then
    return query select false, null::uuid, 'too_soon'::text;
    return;
  end if;
  if p_start > now() + make_interval(days => v_days) then
    return query select false, null::uuid, 'too_far'::text;
    return;
  end if;
  select f.s_resource into v_found
    from public.booking_free_slots(p_ws, p_service, p_start, p_start + interval '1 second', p_party, null, null, p_lead_min, p_max_days) f
   where f.s_start = p_start
   order by f.s_ratio, f.s_resource
   limit 1;
  if v_found is not null then
    return query select true, v_found, null::text;
    return;
  end if;
  v_date := (p_start at time zone v_tz)::date;
  select exists (
    select 1 from public.booking_resources r
     where r.workspace_id = p_ws and r.active and (v_kind is null or r.kind = v_kind)
       and exists (select 1 from public.booking_windows(r.id, p_ws, v_date, v_tz) w
                    where p_start >= w.w_start and p_start + make_interval(mins => v_dur) <= w.w_end)
  ) into v_opened;
  return query select false, null::uuid, (case when v_opened then 'full' else 'closed' end)::text;
end $$;

revoke all on function public.booking_windows(uuid, uuid, date, text) from public, anon, authenticated;
revoke all on function public.booking_free_slots(uuid, uuid, timestamptz, timestamptz, int, uuid, uuid, int, int) from public, anon, authenticated;
revoke all on function public.booking_check_slot(uuid, uuid, timestamptz, int, int, int) from public, anon, authenticated;

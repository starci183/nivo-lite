-- Booking ("Đặt lịch hẹn"): appointments for any service business (spa, salon, clinic, garage, tutoring, studio).
-- Generic by design: a resource is anything that can serve one customer at a time (staff, room, chair, bay: the kind is free text), a service says how long
-- it takes and which KIND of resource it needs. Every table has workspace_id and RLS (read: member, write: owner/manager; the service role bypasses).
-- The availability engine itself is TypeScript (src/lib/module-booking-availability.ts); the database is the authority on double booking (booking_reserve / booking_relocate lock the resource).

-- ---------------------------------------------------------------- policies and public page settings (one row per workspace)
create table public.booking_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  slot_step_min int not null default 15 check (slot_step_min between 5 and 240),
  min_lead_min int not null default 60 check (min_lead_min >= 0),               -- the earliest a customer may book: now + this
  max_advance_days int not null default 60 check (max_advance_days between 1 and 365),
  cancel_window_hours int not null default 24 check (cancel_window_hours >= 0), -- a change or cancellation later than this is "late"
  deposit_pct int not null default 0 check (deposit_pct between 0 and 100),
  late_cancel_fee_pct int not null default 0 check (late_cancel_fee_pct between 0 and 100),
  no_show_fee_vnd bigint not null default 0 check (no_show_fee_vnd >= 0),
  auto_confirm boolean not null default true,                                    -- a free slot within policy is confirmed without asking
  handoff_order boolean not null default false,                                  -- a finished booking with a price becomes a sales order (hand-off chain)
  reminder_hours int[] not null default '{24,2}',
  public_enabled boolean not null default false,
  public_slug text unique check (public_slug ~ '^[a-z0-9][a-z0-9-]{2,40}$'),
  public_note text not null default '',
  address text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- resources, hours, exceptions
create table public.booking_resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  kind text not null default 'staff' check (length(kind) between 1 and 40),     -- staff | room | chair | bay | ...: user-defined
  capacity int not null default 1 check (capacity between 1 and 200),           -- customers served at the same time
  color text not null default '',
  active boolean not null default true,
  staff_id uuid references public.staff (id) on delete set null,                -- optional link to the staff directory (shifts lane may read availability from it)
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index booking_resources_ws on public.booking_resources (workspace_id, sort_order);

-- Working hours: one row per resource, weekday (ISO 1 = Monday ... 7 = Sunday) and window; several windows a day are allowed (lunch break).
create table public.booking_hours (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  resource_id uuid not null references public.booking_resources (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index booking_hours_resource on public.booking_hours (resource_id, weekday);

-- Exceptions on one date: closed (holiday, day off) or different hours. resource_id null = the whole business.
create table public.booking_exceptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  resource_id uuid references public.booking_resources (id) on delete cascade,
  on_date date not null,
  closed boolean not null default true,
  start_time time,
  end_time time,
  note text not null default '',
  check (closed or (start_time is not null and end_time is not null and end_time > start_time))
);
create index booking_exceptions_ws on public.booking_exceptions (workspace_id, on_date);

-- ---------------------------------------------------------------- services
create table public.booking_services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(name) between 1 and 160),
  description text not null default '',
  duration_min int not null check (duration_min between 5 and 1440),
  buffer_min int not null default 0 check (buffer_min between 0 and 480),       -- cleaning / rest AFTER the visit: the resource is blocked for duration + buffer
  price_vnd bigint check (price_vnd is null or price_vnd >= 0),
  resource_kind text,                                                           -- the kind of resource it needs; null = any resource
  followup_days int check (followup_days is null or followup_days between 1 and 730), -- invite the customer back N days after this service
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index booking_services_ws on public.booking_services (workspace_id, sort_order);

-- ---------------------------------------------------------------- bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  conversation_id uuid references public.agent_conversations (id) on delete set null,
  customer_name text not null default '',
  customer_phone text,
  customer_email text,
  service_id uuid not null references public.booking_services (id) on delete restrict,
  resource_id uuid not null references public.booking_resources (id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  block_end_at timestamptz not null,                                            -- end_at + the service's buffer: the resource is taken until here
  party_size int not null default 1 check (party_size between 1 and 200),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'rescheduled', 'cancelled', 'no_show', 'done')),
  holds_slot boolean not null default true,                                     -- false: a request that conflicts and waits for the owner (does not block anyone)
  source_channel text not null default 'manual',                                -- manual | website | telegram | zalo | public_page | api
  price_vnd bigint,
  deposit_vnd bigint not null default 0,
  deposit_status text not null default 'none' check (deposit_status in ('none', 'due', 'paid', 'waived')),
  cancel_fee_vnd bigint not null default 0,
  note text not null default '',
  conflict_note text not null default '',
  checked_in_at timestamptz,
  done_at timestamptz,
  rescheduled_from timestamptz,
  reschedule_count int not null default 0,
  cancelled_at timestamptz,
  cancel_reason text,
  work_item_id uuid references public.work_items (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  idempotency_key text,
  origin text not null default 'live' check (origin in ('live', 'simulated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at and block_end_at >= end_at)
);
create index bookings_ws_start on public.bookings (workspace_id, start_at);
create index bookings_resource_start on public.bookings (resource_id, start_at);
create index bookings_lead on public.bookings (lead_id);
create unique index bookings_idem on public.bookings (workspace_id, idempotency_key) where idempotency_key is not null;

-- ---------------------------------------------------------------- waitlist
create table public.booking_waitlist (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  conversation_id uuid references public.agent_conversations (id) on delete set null,
  customer_name text not null default '',
  customer_phone text,
  service_id uuid not null references public.booking_services (id) on delete cascade,
  resource_id uuid references public.booking_resources (id) on delete set null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  party_size int not null default 1 check (party_size between 1 and 200),
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'booked', 'expired', 'cancelled')),
  notified_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (window_end > window_start)
);
create index booking_waitlist_ws on public.booking_waitlist (workspace_id, status, window_start);

-- ---------------------------------------------------------------- reminders (scheduled when a booking is confirmed or moved; the minute tick sends the due ones through the gate)
create table public.booking_reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind text not null check (kind ~ '^h[0-9]{1,3}$'),                            -- h24 = 24 hours before, h2 = 2 hours before
  due_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'waiting', 'skipped', 'cancelled', 'failed')),
  work_item_id uuid references public.work_items (id) on delete set null,
  note text not null default '',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, kind)
);
create index booking_reminders_due on public.booking_reminders (due_at) where status = 'scheduled';

-- ---------------------------------------------------------------- rate limit for the public page (counters per key and window; the page never trusts a client)
create table public.booking_rate (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['booking_settings', 'booking_resources', 'booking_hours', 'booking_exceptions', 'booking_services', 'bookings', 'booking_waitlist', 'booking_reminders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(workspace_id))', t || '_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id))', t || '_write', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
alter table public.booking_rate enable row level security;
revoke all on public.booking_rate from anon, authenticated;
grant all on public.booking_rate to service_role;

-- ---------------------------------------------------------------- double booking guard (authoritative: the app computes slots, the database refuses overlaps)
-- The highest number of customers on one resource at the same moment inside [p_start, p_block_end), counting only bookings that hold the slot.
create or replace function public.booking_peak_load(p_resource uuid, p_start timestamptz, p_block_end timestamptz, p_exclude uuid)
returns int language sql stable set search_path = public as $$
  select coalesce(max(load), 0)::int from (
    select (select coalesce(sum(b2.party_size), 0) from public.bookings b2
             where b2.resource_id = p_resource and b2.holds_slot and b2.status in ('requested', 'confirmed', 'rescheduled')
               and (p_exclude is null or b2.id <> p_exclude)
               and b2.start_at <= t.t and b2.block_end_at > t.t) as load
      from (
        select p_start as t
        union
        select b.start_at from public.bookings b
         where b.resource_id = p_resource and b.holds_slot and b.status in ('requested', 'confirmed', 'rescheduled')
           and (p_exclude is null or b.id <> p_exclude)
           and b.start_at > p_start and b.start_at < p_block_end
      ) t
  ) q;
$$;

-- Insert one booking only if the resource still has room. p is the row as jsonb (workspace_id, resource_id, service_id, start_at, end_at, block_end_at, ...).
-- Returns the new id, or null when the resource is full. p_force inserts anyway (an owner overriding), holds_slot then follows the row.
create or replace function public.booking_reserve(p jsonb, p_force boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_res uuid := (p ->> 'resource_id')::uuid;
  v_cap int;
  v_party int := coalesce((p ->> 'party_size')::int, 1);
  v_id uuid;
  v_holds boolean := coalesce((p ->> 'holds_slot')::boolean, true);
begin
  perform pg_advisory_xact_lock(hashtextextended(v_res::text, 0));
  select capacity into v_cap from public.booking_resources where id = v_res and workspace_id = (p ->> 'workspace_id')::uuid;
  if v_cap is null then raise exception 'resource not found'; end if;
  if v_holds and not p_force
     and public.booking_peak_load(v_res, (p ->> 'start_at')::timestamptz, (p ->> 'block_end_at')::timestamptz, null) + v_party > v_cap then
    return null;
  end if;
  insert into public.bookings (workspace_id, lead_id, conversation_id, customer_name, customer_phone, customer_email, service_id, resource_id, start_at, end_at, block_end_at,
                               party_size, status, holds_slot, source_channel, price_vnd, deposit_vnd, deposit_status, note, conflict_note, origin, idempotency_key)
  values ((p ->> 'workspace_id')::uuid, nullif(p ->> 'lead_id', '')::uuid, nullif(p ->> 'conversation_id', '')::uuid, coalesce(p ->> 'customer_name', ''), nullif(p ->> 'customer_phone', ''),
          nullif(p ->> 'customer_email', ''), (p ->> 'service_id')::uuid, v_res, (p ->> 'start_at')::timestamptz, (p ->> 'end_at')::timestamptz, (p ->> 'block_end_at')::timestamptz,
          v_party, coalesce(p ->> 'status', 'requested'), v_holds, coalesce(p ->> 'source_channel', 'manual'), nullif(p ->> 'price_vnd', '')::bigint,
          coalesce((p ->> 'deposit_vnd')::bigint, 0), coalesce(p ->> 'deposit_status', 'none'), coalesce(p ->> 'note', ''), coalesce(p ->> 'conflict_note', ''),
          coalesce(p ->> 'origin', 'live'), nullif(p ->> 'idempotency_key', ''))
  returning id into v_id;
  return v_id;
end $$;

-- Move a booking to another time and/or resource if there is room (excluding itself). Returns true when moved.
create or replace function public.booking_relocate(p_booking uuid, p_resource uuid, p_start timestamptz, p_end timestamptz, p_block_end timestamptz, p_force boolean default false)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid;
  v_party int;
  v_cap int;
  v_old timestamptz;
  v_status text;
begin
  select workspace_id, party_size, start_at, status into v_ws, v_party, v_old, v_status from public.bookings where id = p_booking;
  if v_ws is null then raise exception 'booking not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_resource::text, 0));
  select capacity into v_cap from public.booking_resources where id = p_resource and workspace_id = v_ws;
  if v_cap is null then raise exception 'resource not found'; end if;
  if not p_force and public.booking_peak_load(p_resource, p_start, p_block_end, p_booking) + v_party > v_cap then
    return false;
  end if;
  update public.bookings
     set resource_id = p_resource, start_at = p_start, end_at = p_end, block_end_at = p_block_end, holds_slot = true,
         rescheduled_from = case when p_start <> v_old then v_old else rescheduled_from end,
         reschedule_count = reschedule_count + case when p_start <> v_old then 1 else 0 end,
         status = case when p_start <> v_old and v_status in ('confirmed', 'rescheduled') then 'rescheduled' else v_status end,
         conflict_note = '', updated_at = now()
   where id = p_booking;
  return true;
end $$;

-- Counter for the public page: true while the key has fewer than p_limit hits in the current window.
create or replace function public.booking_rate_hit(p_key text, p_limit int, p_window_sec int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_sec) * p_window_sec);
  v_hits int;
begin
  insert into public.booking_rate (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.booking_rate.hits + 1
  returning hits into v_hits;
  delete from public.booking_rate where window_start < now() - interval '2 days';
  return v_hits <= p_limit;
end $$;

revoke all on function public.booking_peak_load(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.booking_reserve(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.booking_relocate(uuid, uuid, timestamptz, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.booking_rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.booking_peak_load(uuid, timestamptz, timestamptz, uuid) to service_role;
grant execute on function public.booking_reserve(jsonb, boolean) to service_role;
grant execute on function public.booking_relocate(uuid, uuid, timestamptz, timestamptz, timestamptz, boolean) to service_role;
grant execute on function public.booking_rate_hit(text, int, int) to service_role;

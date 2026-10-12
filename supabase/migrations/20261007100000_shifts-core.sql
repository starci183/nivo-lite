-- Lịch & ca làm (module "shifts"): staff profiles, positions, coverage, availability, shifts, schedule versions, leave / swap requests,
-- attendance, notification evidence and per-workspace rules. Every table is workspace-scoped with RLS:
--   read   active members (the published schedule is what staff see; drafts and pay are manager-only)
--   write  owner / manager (is_manager) or service role; staff may only create their OWN requests and their own check-in.
-- Weekday convention in this module: 0 = Monday ... 6 = Sunday. Dates and times are the shop's local (Asia/Ho_Chi_Minh) wall clock.

-- ---------------------------------------------------------------- helper: the signed-in member's shifts_staff profile
create table public.shifts_positions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  color text not null default '#2f6fed',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.shifts_staff (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  staff_id uuid references public.staff (id) on delete set null,            -- the shop's `staff` row (Office @handle), when there is one
  user_id uuid references auth.users (id) on delete set null,               -- the signed-in account, when linked directly
  phone text,
  telegram_chat_id text,                                                     -- where the shift messages also go, when linked
  zalo_user_id text,
  position_ids uuid[] not null default '{}',                                -- positions this person can work
  skills text[] not null default '{}',
  max_hours_week numeric(5,1) not null default 48 check (max_hours_week > 0 and max_hours_week <= 120),
  max_hours_day numeric(4,1) not null default 10 check (max_hours_day > 0 and max_hours_day <= 24),
  min_rest_hours numeric(4,1) not null default 10 check (min_rest_hours >= 0 and min_rest_hours <= 24),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index shifts_staff_ws on public.shifts_staff (workspace_id) where active;
create index shifts_staff_link on public.shifts_staff (workspace_id, staff_id);

-- Pay is split from the profile so staff can read colleagues' names (to swap) without reading anyone's wage.
create table public.shifts_staff_pay (
  staff_id uuid primary key references public.shifts_staff (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  hourly_wage_vnd int not null default 0 check (hourly_wage_vnd >= 0),
  updated_at timestamptz not null default now()
);

create or replace function public.shifts_my_profile(ws uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select s.id from public.shifts_staff s
  where s.workspace_id = ws and s.active
    and (s.user_id = auth.uid() or (s.staff_id is not null and s.staff_id = public.my_staff_id(ws)))
  order by s.created_at limit 1;
$$;

create table public.shifts_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  opening_hours jsonb not null default '{}'::jsonb,        -- { "0": {"open":"07:00","close":"22:00"} | null, ... } by weekday
  swap_notice_hours int not null default 24 check (swap_notice_hours >= 0),
  leave_notice_days int not null default 2 check (leave_notice_days >= 0),
  remind_minutes int not null default 60 check (remind_minutes between 5 and 1440),
  noshow_minutes int not null default 10 check (noshow_minutes between 1 and 120),
  overtime_hours_week numeric(4,1) not null default 48,
  updated_at timestamptz not null default now()
);

create table public.shifts_coverage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  position_id uuid not null references public.shifts_positions (id) on delete cascade,
  min_staff int not null default 1 check (min_staff >= 0 and min_staff <= 50),
  ideal_staff int not null default 1 check (ideal_staff >= 0 and ideal_staff <= 50),
  is_peak boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_time > start_time and ideal_staff >= min_staff)
);
create index shifts_coverage_ws on public.shifts_coverage (workspace_id, weekday);

-- Availability: recurring (weekday set) or a date override (shift_date set). A request from staff starts 'pending' until a manager approves it.
create table public.shifts_availability (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  staff_id uuid not null references public.shifts_staff (id) on delete cascade,
  weekday smallint check (weekday between 0 and 6),
  shift_date date,
  start_time time not null default '00:00',
  end_time time not null default '23:59',
  available boolean not null default true,
  note text not null default '',
  status text not null default 'approved' check (status in ('pending', 'approved', 'declined')),
  decided_by text,
  created_at timestamptz not null default now(),
  check ((weekday is not null) <> (shift_date is not null))
);
create index shifts_availability_staff on public.shifts_availability (staff_id, status);

-- One row per week version; draft until published (publish_schedule). `evidence` keeps what the solver and the checks found.
create table public.shifts_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  week_start date not null,                                  -- the Monday
  version int not null default 1,
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded')),
  source text not null default 'solver' check (source in ('solver', 'manual')),
  cost_vnd bigint not null default 0,
  summary jsonb not null default '{}'::jsonb,                -- coverage / hours / issue counts
  evidence jsonb not null default '{}'::jsonb,               -- solver report, explanation source, publish decision
  explanation text not null default '',                      -- written by OpenClaw from the solver report (never the schedule itself)
  solver_ms int,
  work_item_id uuid references public.work_items (id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (workspace_id, week_start, version)
);
create index shifts_schedules_week on public.shifts_schedules (workspace_id, week_start desc);

create table public.shifts_shifts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  schedule_id uuid not null references public.shifts_schedules (id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  position_id uuid not null references public.shifts_positions (id) on delete cascade,
  staff_id uuid references public.shifts_staff (id) on delete set null,   -- null = open shift ("ca trống")
  status text not null default 'draft' check (status in ('draft', 'published', 'swapped', 'cancelled')),
  source text not null default 'solver' check (source in ('solver', 'manual', 'swap')),
  note text not null default '',
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index shifts_shifts_schedule on public.shifts_shifts (schedule_id);
create index shifts_shifts_staff_date on public.shifts_shifts (workspace_id, staff_id, shift_date);

create table public.shifts_leave_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  staff_id uuid not null references public.shifts_staff (id) on delete cascade,
  from_date date not null,
  to_date date not null,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  work_item_id uuid references public.work_items (id) on delete set null,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create index shifts_leave_ws on public.shifts_leave_requests (workspace_id, status, from_date);

-- kind 'swap': from_staff_id offers its shift to to_staff_id.  kind 'claim': to_staff_id asks for an open shift (from_staff_id null).
create table public.shifts_swap_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null default 'swap' check (kind in ('swap', 'claim')),
  shift_id uuid not null references public.shifts_shifts (id) on delete cascade,
  from_staff_id uuid references public.shifts_staff (id) on delete cascade,
  to_staff_id uuid not null references public.shifts_staff (id) on delete cascade,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  checks jsonb not null default '[]'::jsonb,                  -- rule findings at decision time
  work_item_id uuid references public.work_items (id) on delete set null,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index shifts_swap_ws on public.shifts_swap_requests (workspace_id, status);

create table public.shifts_attendance (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  shift_id uuid not null references public.shifts_shifts (id) on delete cascade,
  staff_id uuid not null references public.shifts_staff (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  unique (shift_id, staff_id)
);

-- Evidence of every message the module sent to a person (Office / Telegram / Zalo) and of alerts to the owner.
create table public.shifts_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  staff_id uuid references public.shifts_staff (id) on delete set null,
  schedule_id uuid references public.shifts_schedules (id) on delete set null,
  shift_id uuid references public.shifts_shifts (id) on delete set null,
  kind text not null check (kind in ('publish', 'reminder', 'swap', 'leave', 'no_show', 'gap', 'payroll')),
  channel text not null check (channel in ('office', 'telegram', 'zalo')),
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  body text not null default '',
  error text,
  created_at timestamptz not null default now()
);
create index shifts_notifications_ws on public.shifts_notifications (workspace_id, created_at desc);

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['shifts_positions', 'shifts_staff', 'shifts_staff_pay', 'shifts_settings', 'shifts_coverage', 'shifts_availability',
    'shifts_schedules', 'shifts_shifts', 'shifts_leave_requests', 'shifts_swap_requests', 'shifts_attendance', 'shifts_notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Reference data every member reads; managers write.
create policy shifts_positions_read on public.shifts_positions for select to authenticated using (public.is_member(workspace_id));
create policy shifts_positions_write on public.shifts_positions for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy shifts_staff_read on public.shifts_staff for select to authenticated using (public.is_member(workspace_id));
create policy shifts_staff_write on public.shifts_staff for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy shifts_settings_read on public.shifts_settings for select to authenticated using (public.is_member(workspace_id));
create policy shifts_settings_write on public.shifts_settings for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy shifts_coverage_read on public.shifts_coverage for select to authenticated using (public.is_manager(workspace_id));
create policy shifts_coverage_write on public.shifts_coverage for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));

-- Pay: managers only.
create policy shifts_staff_pay_all on public.shifts_staff_pay for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));

-- Availability: managers all; staff read all of their own and add / edit their own (pending until approved).
create policy shifts_availability_read on public.shifts_availability for select to authenticated
  using (public.is_manager(workspace_id) or (public.is_member(workspace_id) and staff_id = public.shifts_my_profile(workspace_id)));
create policy shifts_availability_mgr on public.shifts_availability for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy shifts_availability_own_insert on public.shifts_availability for insert to authenticated
  with check (public.is_member(workspace_id) and staff_id = public.shifts_my_profile(workspace_id) and status = 'pending');

-- Schedules and shifts: staff read only what is published; managers read and write everything.
create policy shifts_schedules_read on public.shifts_schedules for select to authenticated
  using (public.is_manager(workspace_id) or (public.is_member(workspace_id) and status = 'published'));
create policy shifts_schedules_write on public.shifts_schedules for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy shifts_shifts_read on public.shifts_shifts for select to authenticated
  using (public.is_manager(workspace_id) or (public.is_member(workspace_id) and status in ('published', 'swapped')));
create policy shifts_shifts_write on public.shifts_shifts for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));

-- Requests: managers all; staff read their own and create their own (pending).
create policy shifts_leave_read on public.shifts_leave_requests for select to authenticated
  using (public.is_manager(workspace_id) or (public.is_member(workspace_id) and staff_id = public.shifts_my_profile(workspace_id)));
create policy shifts_leave_mgr on public.shifts_leave_requests for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy shifts_leave_own_insert on public.shifts_leave_requests for insert to authenticated
  with check (public.is_member(workspace_id) and staff_id = public.shifts_my_profile(workspace_id) and status = 'pending');
create policy shifts_swap_read on public.shifts_swap_requests for select to authenticated
  using (public.is_manager(workspace_id) or (public.is_member(workspace_id) and (from_staff_id = public.shifts_my_profile(workspace_id) or to_staff_id = public.shifts_my_profile(workspace_id))));
create policy shifts_swap_mgr on public.shifts_swap_requests for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy shifts_swap_own_insert on public.shifts_swap_requests for insert to authenticated
  with check (public.is_member(workspace_id) and status = 'pending'
    and (from_staff_id = public.shifts_my_profile(workspace_id) or (kind = 'claim' and to_staff_id = public.shifts_my_profile(workspace_id))));

-- Attendance: managers read all; a person reads and records their own check-in.
create policy shifts_attendance_read on public.shifts_attendance for select to authenticated
  using (public.is_manager(workspace_id) or (public.is_member(workspace_id) and staff_id = public.shifts_my_profile(workspace_id)));
create policy shifts_attendance_mgr on public.shifts_attendance for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy shifts_attendance_own_insert on public.shifts_attendance for insert to authenticated
  with check (public.is_member(workspace_id) and staff_id = public.shifts_my_profile(workspace_id));

-- Notifications: managers read; a person reads their own. Written by the app (service role).
create policy shifts_notifications_read on public.shifts_notifications for select to authenticated
  using (public.is_manager(workspace_id) or (public.is_member(workspace_id) and staff_id = public.shifts_my_profile(workspace_id)));
revoke insert, update, delete on public.shifts_notifications from authenticated;

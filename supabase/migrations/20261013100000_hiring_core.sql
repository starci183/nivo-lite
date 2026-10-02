-- Hiring ("Tuyển dụng", module key `hiring`): job posts, candidates, interviews, offers, consent, retention.
-- Every table has workspace_id and RLS: managers (owner/manager) read and write; an interviewer also reads the interviews that are theirs.
-- Candidate data is personal data: the public apply route, the candidate's slot/offer links and the retention job all run with the service role
-- in the app (src/lib/module-hiring-*.ts); nothing here is granted to `anon`.
-- CV files live in the private bucket `hiring` (first path segment = workspace id), retention deletes them with the candidate.

-- ---------------------------------------------------------------- settings
create table public.hiring_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  public_slug text not null unique check (public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(public_slug) between 3 and 60),
  retention_days int not null default 90 check (retention_days between 7 and 730),   -- rejected / withdrawn candidates are deleted after this many days
  notify_new_candidate boolean not null default true,
  remind_interview boolean not null default true,
  auto_close_when_filled boolean not null default true,
  apply_consent_text text not null default 'Tôi đồng ý để doanh nghiệp lưu hồ sơ và thông tin tôi cung cấp để xét tuyển. Hồ sơ chỉ dùng cho việc tuyển dụng và được xóa khi hết thời hạn lưu trữ hoặc khi tôi yêu cầu.',
  ad_tone text not null default 'thân thiện, rõ ràng, tôn trọng',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- jobs
create table public.hiring_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80),
  title text not null check (char_length(title) between 3 and 140),
  position text not null default '',
  employment_type text not null default 'full_time' check (employment_type in ('full_time', 'part_time')),
  schedule text not null default '',
  pay_min_vnd bigint check (pay_min_vnd is null or pay_min_vnd >= 0),
  pay_max_vnd bigint check (pay_max_vnd is null or pay_max_vnd >= 0),
  pay_unit text not null default 'month' check (pay_unit in ('month', 'hour', 'shift')),
  location text not null default '',
  headcount int not null default 1 check (headcount between 1 and 500),
  description text not null default '',
  -- { skills: string[], experience_years: number|null, experience_note: string, availability: string[], must_have: string[], nice_to_have: string[] }
  requirements jsonb not null default '{}'::jsonb,
  -- [{ id, text, type: text|yesno|number|choice, required, choices?: string[], expect?: yes|no|number|string[] }]
  questions jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'open', 'paused', 'closed')),
  channels text[] not null default array['page', 'chat']::text[],
  ad_variants jsonb,            -- { facebook, zalo, topcv, generated_at, ms }
  closes_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);
create index hiring_jobs_ws on public.hiring_jobs (workspace_id, status);

-- ---------------------------------------------------------------- candidates
create table public.hiring_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_id uuid not null references public.hiring_jobs (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  phone text not null default '',
  email text not null default '',
  source text not null default 'page' check (source in ('page', 'chat', 'manual')),
  conversation_id uuid references public.agent_conversations (id) on delete set null,
  cv_path text,                  -- in bucket `hiring`
  cv_name text,
  cv_mime text,
  cv_size int,
  answers jsonb not null default '[]'::jsonb,   -- [{ question_id, question, answer }]
  availability text not null default '',
  score int check (score is null or score between 0 and 100),
  score_label text check (score_label is null or score_label in ('fit', 'consider', 'not_fit')),
  score_reasons jsonb not null default '[]'::jsonb,  -- [{ criterion, status: met|unmet|unknown, note }]
  score_summary text,
  screened_at timestamptz,
  stage text not null default 'applied' check (stage in ('applied', 'screening', 'shortlisted', 'interview', 'offer', 'hired', 'rejected', 'withdrawn')),
  stage_changed_at timestamptz not null default now(),
  rejected_reason text,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index hiring_candidates_job on public.hiring_candidates (job_id, stage);
create index hiring_candidates_ws on public.hiring_candidates (workspace_id, stage_changed_at);
-- one application per person per job (phone, digits only)
create unique index hiring_candidates_job_phone on public.hiring_candidates (job_id, phone) where phone <> '';

-- timeline of one candidate: who did what (agent, owner, candidate)
create table public.hiring_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  candidate_id uuid not null references public.hiring_candidates (id) on delete cascade,
  kind text not null,
  actor text not null,
  summary text not null,
  created_at timestamptz not null default now()
);
create index hiring_events_candidate on public.hiring_events (candidate_id, created_at);

-- consent: asked and given before any personal data is stored
create table public.hiring_consents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  candidate_id uuid not null references public.hiring_candidates (id) on delete cascade,
  channel text not null check (channel in ('page', 'chat', 'manual')),
  consent_text text not null,
  ip_hash text,
  given_at timestamptz not null default now()
);
create index hiring_consents_candidate on public.hiring_consents (candidate_id);

-- ---------------------------------------------------------------- availability (per member) and interviews
create table public.hiring_availability (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_user_id uuid not null references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),     -- 0 = Sunday
  start_min int not null check (start_min between 0 and 1439),    -- minutes from midnight, Vietnam time
  end_min int not null check (end_min between 1 and 1440),
  check (end_min > start_min)
);
create index hiring_availability_member on public.hiring_availability (workspace_id, member_user_id);

create table public.hiring_interviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  candidate_id uuid not null references public.hiring_candidates (id) on delete cascade,
  job_id uuid not null references public.hiring_jobs (id) on delete cascade,
  interviewer_user_id uuid references auth.users (id) on delete set null,
  interviewer_name text not null default '',
  mode text not null default 'in_person' check (mode in ('in_person', 'online')),
  location text not null default '',          -- address, or the online link
  duration_min int not null default 30 check (duration_min between 10 and 240),
  proposed_slots jsonb not null default '[]'::jsonb,   -- [{ start, end }] ISO
  slot_start timestamptz,
  slot_end timestamptz,
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'done', 'cancelled', 'no_show')),
  token text not null unique,
  work_item_id uuid references public.work_items (id) on delete set null,
  reminder_sent_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index hiring_interviews_ws on public.hiring_interviews (workspace_id, slot_start);
create index hiring_interviews_candidate on public.hiring_interviews (candidate_id);

-- ---------------------------------------------------------------- offers
create table public.hiring_offers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  candidate_id uuid not null references public.hiring_candidates (id) on delete cascade,
  job_id uuid not null references public.hiring_jobs (id) on delete cascade,
  terms jsonb not null default '{}'::jsonb,     -- { title, pay, start_date, probation, note }
  draft text not null default '',
  status text not null default 'draft' check (status in ('draft', 'waiting', 'sent', 'accepted', 'declined', 'expired', 'cancelled')),
  token text not null unique,
  work_item_id uuid references public.work_items (id) on delete set null,
  sent_via text check (sent_via is null or sent_via in ('email', 'chat', 'manual')),
  sent_at timestamptz,
  expires_at timestamptz,
  responded_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index hiring_offers_ws on public.hiring_offers (workspace_id, status);
create index hiring_offers_candidate on public.hiring_offers (candidate_id);

-- ---------------------------------------------------------------- onboarding ("Nhận việc")
create table public.hiring_onboarding (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  candidate_id uuid not null references public.hiring_candidates (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  done_at timestamptz,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index hiring_onboarding_candidate on public.hiring_onboarding (candidate_id, sort);

-- the person who was hired, linked to a staff profile when the shifts module is there (no foreign key: the shifts tables may not exist)
alter table public.hiring_candidates add column staff_id uuid;

-- ---------------------------------------------------------------- apply hits (rate limit of the public route) and retention log
create table public.hiring_apply_hits (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  workspace_id uuid,
  kind text not null default 'apply',
  created_at timestamptz not null default now()
);
create index hiring_apply_hits_ip on public.hiring_apply_hits (ip_hash, created_at desc);

create table public.hiring_retention_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  deleted_candidates int not null default 0,
  deleted_files int not null default 0,
  retention_days int not null,
  ran_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
alter table public.hiring_settings enable row level security;
alter table public.hiring_jobs enable row level security;
alter table public.hiring_candidates enable row level security;
alter table public.hiring_events enable row level security;
alter table public.hiring_consents enable row level security;
alter table public.hiring_availability enable row level security;
alter table public.hiring_interviews enable row level security;
alter table public.hiring_offers enable row level security;
alter table public.hiring_onboarding enable row level security;
alter table public.hiring_apply_hits enable row level security;
alter table public.hiring_retention_log enable row level security;

-- jobs and settings are shop information: every member reads, managers write
create policy hiring_settings_read on public.hiring_settings for select to authenticated using (public.is_member(workspace_id));
create policy hiring_settings_write on public.hiring_settings for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy hiring_jobs_read on public.hiring_jobs for select to authenticated using (public.is_member(workspace_id));
create policy hiring_jobs_write on public.hiring_jobs for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));

-- candidate data: managers only
create policy hiring_candidates_manage on public.hiring_candidates for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy hiring_events_read on public.hiring_events for select to authenticated using (public.is_manager(workspace_id));
create policy hiring_consents_read on public.hiring_consents for select to authenticated using (public.is_manager(workspace_id));
create policy hiring_offers_manage on public.hiring_offers for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy hiring_onboarding_manage on public.hiring_onboarding for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy hiring_retention_log_read on public.hiring_retention_log for select to authenticated using (public.is_manager(workspace_id));

-- availability: a member edits their own; managers edit anyone's; members read
create policy hiring_availability_read on public.hiring_availability for select to authenticated using (public.is_member(workspace_id));
create policy hiring_availability_write on public.hiring_availability for all to authenticated
  using (public.is_manager(workspace_id) or (public.is_member(workspace_id) and member_user_id = auth.uid()))
  with check (public.is_manager(workspace_id) or (public.is_member(workspace_id) and member_user_id = auth.uid()));

-- interviews: managers, and the interviewer reads their own
create policy hiring_interviews_manage on public.hiring_interviews for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy hiring_interviews_own on public.hiring_interviews for select to authenticated using (interviewer_user_id = auth.uid() and public.is_member(workspace_id));

-- hits and anything not granted: service role only
revoke all on public.hiring_apply_hits from anon, authenticated;
revoke all on public.hiring_settings, public.hiring_jobs, public.hiring_candidates, public.hiring_events, public.hiring_consents, public.hiring_availability,
  public.hiring_interviews, public.hiring_offers, public.hiring_onboarding, public.hiring_retention_log from anon;
-- events, consents and the retention log are written by the app only
revoke insert, update, delete on public.hiring_events, public.hiring_consents, public.hiring_retention_log from authenticated;

-- ---------------------------------------------------------------- Storage: private bucket `hiring` (CV files)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('hiring', 'hiring', false, 5242880, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists hiring_cv_manager_read on storage.objects;
drop policy if exists hiring_cv_manager_delete on storage.objects;
create policy hiring_cv_manager_read on storage.objects for select to authenticated using (bucket_id = 'hiring' and public.storage_ws_manager(name));
create policy hiring_cv_manager_delete on storage.objects for delete to authenticated using (bucket_id = 'hiring' and public.storage_ws_manager(name));

-- ---------------------------------------------------------------- the 5-minute tick (reminders, offer expiry, retention, auto-close)
-- Same wiring as automation_tick(): pg_cron -> pg_net -> the app route /api/hiring/tick, signed with HMAC-SHA256 over the timestamp.
-- It reads the same Vault entries ('nivo_tick_url' points at /api/automation/tick: the hiring route sits next to it, 'nivo_tick_key' signs).
create or replace function public.hiring_tick()
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_key text; v_ts text := (floor(extract(epoch from now()) * 1000))::bigint::text;
begin
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'nivo_tick_url' limit 1;
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivo_tick_key' limit 1;
  exception when others then
    return false;
  end;
  if v_url is null or v_key is null then return false; end if;
  if not exists (select 1 from public.hiring_settings) then return false; end if;
  perform net.http_post(
    url := replace(v_url, '/api/automation/tick', '/api/hiring/tick'), body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-tick-timestamp', v_ts,
      'x-tick-signature', encode(extensions.hmac(v_ts, v_key, 'sha256'), 'hex')),
    timeout_milliseconds := 25000);
  return true;
exception when others then
  raise notice 'hiring_tick failed: %', sqlerrm;
  return false;
end $$;
revoke all on function public.hiring_tick() from public, anon, authenticated;
grant execute on function public.hiring_tick() to service_role;

do $$
begin
  begin create extension if not exists pg_net; exception when others then raise notice 'pg_net is not available here (%)', sqlerrm; end;
  begin create extension if not exists pg_cron; exception when others then raise notice 'pg_cron is not available here (%)', sqlerrm; end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('hiring-tick', '*/5 * * * *', 'select public.hiring_tick()');
    exception when others then
      raise notice 'could not schedule hiring-tick (%)', sqlerrm;
    end;
    -- the hit table is only for the rate limit: keep a day
    begin
      perform cron.schedule('hiring-apply-hits-prune', '17 3 * * *', $cron$ delete from public.hiring_apply_hits where created_at < now() - interval '1 day' $cron$);
    exception when others then
      raise notice 'could not schedule hiring-apply-hits-prune (%)', sqlerrm;
    end;
  end if;
end $$;

-- A read-only status for operators (service role): is the retention tick scheduled, and what is due.
create or replace function public.hiring_ops_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_jobs jsonb := '[]'::jsonb; v_due int;
begin
  begin
    select coalesce(jsonb_agg(jsonb_build_object('jobname', jobname, 'schedule', schedule, 'active', active)), '[]'::jsonb)
      into v_jobs from cron.job where jobname like 'hiring-%';
  exception when others then
    v_jobs := '[]'::jsonb;
  end;
  select count(*) into v_due from public.hiring_candidates c join public.hiring_settings s on s.workspace_id = c.workspace_id
    where c.stage in ('rejected', 'withdrawn') and c.stage_changed_at < now() - make_interval(days => s.retention_days);
  return jsonb_build_object('cron', v_jobs, 'retention_due', v_due);
end $$;
revoke all on function public.hiring_ops_status() from public, anon, authenticated;
grant execute on function public.hiring_ops_status() to service_role;

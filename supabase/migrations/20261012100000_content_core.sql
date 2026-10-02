-- Module "content" (Nội dung mạng xã hội): content pillars, posting cadence, brand settings, month plans and the posts themselves.
--   content_pillars   user-defined themes (sản phẩm, kiến thức, khách hàng, hậu trường, ưu đãi...) with a target weight
--   content_cadence   how often to post per channel (posts per week, weekdays, time of day)
--   content_settings  one row per workspace: brand voice overrides, default hashtags, which automations are on
--   content_plans     one row per "Lên kế hoạch tháng" run (month, how long OpenClaw took, how many ideas)
--   content_items     the posts: idea -> draft -> waiting_approval -> approved -> published | skipped, with one text variant per channel
-- Rows are read by members and written by owner/manager (RLS) or the service role (engine, tick, scripts). Nothing here posts anywhere:
-- publishing goes through the authority action `publish_post` (always "ask") and the "Đăng" step is copy-ready + "Đánh dấu đã đăng".

create table public.content_pillars (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  description text not null default '',
  weight int not null default 1 check (weight between 0 and 20),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);
create index content_pillars_ws on public.content_pillars (workspace_id, sort);

create table public.content_cadence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  channel text not null check (channel in ('facebook', 'zalo', 'tiktok', 'instagram')),
  posts_per_week int not null default 3 check (posts_per_week between 0 and 21),
  days int[] not null default '{}',                        -- ISO weekdays: 1 = Monday ... 7 = Sunday
  post_time text not null default '19:30' check (post_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),  -- Vietnam time
  created_at timestamptz not null default now(),
  unique (workspace_id, channel)
);

create table public.content_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  brand_voice text not null default '',                    -- overrides / adds to the tone gate of the applied context
  avoid text not null default '',                          -- extra things never to say
  cta text not null default '',                            -- the usual call to action ("Nhắn tin để đặt lịch")
  hashtags text[] not null default '{}',                   -- brand hashtags added to TikTok / Instagram
  automations jsonb not null default '{"today_reminder": false, "offer_draft": false, "weekly_summary": false}'::jsonb,
  marks jsonb not null default '{}'::jsonb,                -- dedupe marks of the automations: { reminder_day, summary_week, offer_seen_at }
  updated_at timestamptz not null default now()
);

create table public.content_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  month date not null,                                     -- first day of the month
  status text not null default 'done' check (status in ('done', 'failed')),
  idea_count int not null default 0,
  ai_ms int,                                               -- how long OpenClaw took
  note text,                                               -- error or remark
  meta jsonb not null default '{}'::jsonb,                 -- { generation_id, usage, timings, holidays[] }
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create index content_plans_ws on public.content_plans (workspace_id, created_at desc);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  plan_id uuid references public.content_plans (id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 200),
  brief text not null default '',                          -- the idea: angle, key message, what facts to use
  pillar_id uuid references public.content_pillars (id) on delete set null,
  channels text[] not null default '{facebook}',
  scheduled_at timestamptz,
  status text not null default 'idea' check (status in ('idea', 'draft', 'waiting_approval', 'approved', 'published', 'skipped')),
  variants jsonb not null default '{}'::jsonb,             -- { facebook: { text, hashtags[], note }, zalo: {...}, tiktok: {...}, instagram: {...} }
  hashtags text[] not null default '{}',
  media jsonb not null default '[]'::jsonb,                -- [{ kind: 'media'|'video_render', path|id, name, suggested? }]
  links jsonb not null default '[]'::jsonb,                -- [{ url, label }]
  holiday_key text,                                        -- key in resources/content/calendar-vn.json when the idea is about a date
  evidence jsonb not null default '[]'::jsonb,             -- [{ at, kind, by, text }]  who drafted, approved, marked published, and what proves it
  published jsonb not null default '{}'::jsonb,            -- { facebook: { at, by, url, how } } per channel
  work_item_id uuid,                                       -- the publish_post decision (work_items) while it waits or after it was decided
  drafted_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  published_at timestamptz,
  source text not null default 'manual' check (source in ('manual', 'plan', 'quick', 'offer', 'automation')),
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_items_ws_when on public.content_items (workspace_id, scheduled_at);
create index content_items_ws_status on public.content_items (workspace_id, status);

create or replace function public.content_items_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger content_items_touch before update on public.content_items for each row execute function public.content_items_touch();
create or replace function public.content_settings_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger content_settings_touch before update on public.content_settings for each row execute function public.content_settings_touch();

-- ---------------------------------------------------------------- RLS: members read, owner/manager write
alter table public.content_pillars enable row level security;
alter table public.content_cadence enable row level security;
alter table public.content_settings enable row level security;
alter table public.content_plans enable row level security;
alter table public.content_items enable row level security;

create policy content_pillars_read on public.content_pillars for select to authenticated using (public.is_member(workspace_id));
create policy content_pillars_write on public.content_pillars for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy content_cadence_read on public.content_cadence for select to authenticated using (public.is_member(workspace_id));
create policy content_cadence_write on public.content_cadence for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy content_settings_read on public.content_settings for select to authenticated using (public.is_member(workspace_id));
create policy content_settings_write on public.content_settings for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy content_plans_read on public.content_plans for select to authenticated using (public.is_member(workspace_id));
create policy content_plans_write on public.content_plans for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy content_items_read on public.content_items for select to authenticated using (public.is_member(workspace_id));
create policy content_items_write on public.content_items for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));

revoke all on public.content_pillars, public.content_cadence, public.content_settings, public.content_plans, public.content_items from anon, authenticated;
grant select, insert, update, delete on public.content_pillars, public.content_cadence, public.content_settings, public.content_plans, public.content_items to authenticated;
grant all on public.content_pillars, public.content_cadence, public.content_settings, public.content_plans, public.content_items to service_role;

-- ---------------------------------------------------------------- the quarter-hour tick of the content automations
-- Same plumbing as the automation tick: pg_cron -> pg_net -> POST /api/content/tick, signed with the same Vault key. The URL is derived from
-- 'nivo_tick_url' (…/api/automation/tick -> …/api/content/tick). With the secrets missing, or pg_net / pg_cron unavailable, nothing is scheduled
-- and any external scheduler can call the route. Only workspaces with an automation switched on are worth a call.
create or replace function public.content_tick()
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
  if not exists (
    select 1 from public.content_settings s
     where (s.automations ->> 'today_reminder') = 'true' or (s.automations ->> 'offer_draft') = 'true' or (s.automations ->> 'weekly_summary') = 'true'
  ) then return false; end if;
  perform net.http_post(
    url := replace(v_url, '/api/automation/tick', '/api/content/tick'), body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-tick-timestamp', v_ts,
      'x-tick-signature', encode(extensions.hmac(v_ts, v_key, 'sha256'), 'hex')),
    timeout_milliseconds := 20000);
  return true;
exception when others then
  raise notice 'content_tick failed: %', sqlerrm;
  return false;
end $$;
revoke all on function public.content_tick() from public, anon, authenticated;
grant execute on function public.content_tick() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('nivo-content-tick', '*/15 * * * *', 'select public.content_tick()');
    exception when others then
      raise notice 'could not schedule nivo-content-tick (%)', sqlerrm;
    end;
  end if;
end $$;

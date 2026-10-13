-- "Tạo video" module: projects (a script + the spec built from it + the renders it produced), their versions, and the workspace brand kit.
-- Renders themselves live in public.video_renders (render lane); a project only points at them.
-- Members read their workspace; owner/manager write (the app's server code uses the service role after checking the session).

create table public.video_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  goal text not null default 'service' check (goal in ('service', 'offer', 'testimonial', 'behind_scenes', 'hiring', 'custom')),
  aspect text not null default '9:16' check (aspect in ('9:16', '1:1', '16:9')),
  target_seconds int not null default 30 check (target_seconds between 10 and 90),
  status text not null default 'draft' check (status in ('draft', 'scripting', 'rendering', 'ready', 'approved', 'published', 'archived')),
  inputs jsonb not null default '{}'::jsonb,        -- { source_ids: uuid[], notes: text, template: key, auto: bool }
  script jsonb not null default '[]'::jsonb,        -- the editable scenes: [{ id, role, caption, voiceover, visual, media: path|null }]
  current_spec jsonb,                               -- the VideoSpec last sent to the renderer
  render_id uuid references public.video_renders (id) on delete set null,
  render_ids uuid[] not null default '{}',
  version int not null default 1,
  script_ms int,                                    -- how long OpenClaw took to write the script
  script_meta jsonb not null default '{}'::jsonb,   -- { generation_id, timings, usage, started_at }
  last_error text,
  source_project_id uuid references public.video_projects (id) on delete set null,
  approved_by_name text,
  approved_at timestamptz,
  publish_work_item_id uuid references public.work_items (id) on delete set null,
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index video_projects_workspace on public.video_projects (workspace_id, updated_at desc);

create table public.video_project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version int not null,
  script jsonb not null,
  spec jsonb,
  render_id uuid references public.video_renders (id) on delete set null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);
create index video_project_versions_ws on public.video_project_versions (workspace_id, created_at desc);

create table public.video_brand_kits (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  shop_name text not null default '' check (char_length(shop_name) <= 60),
  primary_color text not null default '#16a34a' check (primary_color ~ '^#[0-9a-f]{6}$'),
  secondary_color text not null default '#0f172a' check (secondary_color ~ '^#[0-9a-f]{6}$'),
  logo_path text,                                   -- in bucket `media`
  music_track text,                                 -- sunny-pop | calm-glow | bold-beat | null = no music
  voice text not null default 'vi-VN-HoaiMyNeural',
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.video_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger video_projects_touch before update on public.video_projects for each row execute function public.video_touch();
create trigger video_brand_kits_touch before update on public.video_brand_kits for each row execute function public.video_touch();

alter table public.video_projects enable row level security;
alter table public.video_project_versions enable row level security;
alter table public.video_brand_kits enable row level security;

create policy video_projects_read on public.video_projects for select to authenticated using (public.is_member(workspace_id));
create policy video_projects_write on public.video_projects for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy video_project_versions_read on public.video_project_versions for select to authenticated using (public.is_member(workspace_id));
create policy video_project_versions_write on public.video_project_versions for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy video_brand_kits_read on public.video_brand_kits for select to authenticated using (public.is_member(workspace_id));
create policy video_brand_kits_write on public.video_brand_kits for all to authenticated using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));

revoke all on public.video_projects, public.video_project_versions, public.video_brand_kits from anon;
grant select, insert, update, delete on public.video_projects, public.video_project_versions, public.video_brand_kits to authenticated;
grant all on public.video_projects, public.video_project_versions, public.video_brand_kits to service_role;

-- A video project is the subject of a publish_video / render_draft work item. The original CHECK listed six subjects; a pattern lets every module name its own
-- (and cannot be overwritten by another lane's migration).
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'public.work_items'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%subject_type%'
  loop
    execute format('alter table public.work_items drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.work_items add constraint work_items_subject_type_format check (subject_type ~ '^[a-z][a-z_]{1,30}$');

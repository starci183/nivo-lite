-- Video rendering (engine job kind `video.render`) and the Storage buckets it uses.
--   media   private, per workspace ("<workspace_id>/<file>"): images, videos and logos members upload; the engine reads them with the service role.
--   videos  private, per workspace ("<workspace_id>/<render_id>/video.mp4|poster.jpg"): written ONLY by the engine (service role); members read.
-- video_renders is written only through the service role (the app's server code and the signed engine callback); members can read their workspace's rows.

create table public.video_renders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  spec jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'rendering', 'done', 'failed')),
  progress int not null default 0 check (progress between 0 and 100),
  stage text,                                     -- tts | scenes | mix | encode | upload (what the engine is doing now)
  output_path text,                               -- in bucket `videos`
  poster_path text,                               -- in bucket `videos`
  duration_ms int,
  size_bytes bigint,
  error text,
  meta jsonb not null default '{}'::jsonb,        -- { width, height, warnings[], tts{...}, timings{...}, memory{...}, loudness{...} }
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index video_renders_workspace on public.video_renders (workspace_id, created_at desc);
create index video_renders_open on public.video_renders (created_at) where status in ('queued', 'rendering');

create or replace function public.video_renders_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger video_renders_touch before update on public.video_renders for each row execute function public.video_renders_touch();

alter table public.video_renders enable row level security;
create policy video_renders_read on public.video_renders for select to authenticated using (public.is_member(workspace_id));
revoke all on public.video_renders from anon, authenticated;
grant select on public.video_renders to authenticated;
grant all on public.video_renders to service_role;

-- A render nobody finished (engine down, job lost) must not look "rendering" for ever.
create or replace function public.video_renders_reap() returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with r as (
    update public.video_renders set status = 'failed', error = coalesce(error, 'timed out'), finished_at = now()
     where status in ('queued', 'rendering') and created_at < now() - interval '30 minutes'
    returning 1)
  select count(*) into v_n from r;
  return v_n;
end $$;
revoke all on function public.video_renders_reap() from public, anon, authenticated;
grant execute on function public.video_renders_reap() to service_role;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('video-renders-reap', '*/10 * * * *', $cron$ select public.video_renders_reap() $cron$);
    exception when others then
      raise notice 'could not schedule video-renders-reap (%)', sqlerrm;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------- Storage
-- The first path segment of an object is the workspace id. Not a uuid -> no access (never an error: the policy runs for every bucket).
create or replace function public.storage_ws_member(p_name text) returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return public.is_member(split_part(p_name, '/', 1)::uuid);
exception when others then
  return false;
end $$;
create or replace function public.storage_ws_manager(p_name text) returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return public.is_manager(split_part(p_name, '/', 1)::uuid);
exception when others then
  return false;
end $$;
grant execute on function public.storage_ws_member(text), public.storage_ws_manager(text) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']),
  ('videos', 'videos', false, 52428800, array['video/mp4', 'image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists media_member_read on storage.objects;
drop policy if exists media_member_insert on storage.objects;
drop policy if exists media_manager_delete on storage.objects;
drop policy if exists videos_member_read on storage.objects;
drop policy if exists videos_manager_delete on storage.objects;

create policy media_member_read on storage.objects for select to authenticated using (bucket_id = 'media' and public.storage_ws_member(name));
create policy media_member_insert on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.storage_ws_member(name));
create policy media_manager_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and public.storage_ws_manager(name));
create policy videos_member_read on storage.objects for select to authenticated using (bucket_id = 'videos' and public.storage_ws_member(name));
create policy videos_manager_delete on storage.objects for delete to authenticated using (bucket_id = 'videos' and public.storage_ws_manager(name));

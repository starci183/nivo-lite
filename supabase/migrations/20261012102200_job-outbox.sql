-- Background jobs: a transactional OUTBOX in Postgres, relayed into BullMQ (Redis) by the engine. See docs/JOBS.md.
--
-- The contract every producer and worker codes against:
--   * job_outbox                       one row per job; dedupe_key is the BullMQ jobId, so a job exists once however often it is relayed.
--   * job_outbox_claim(p_limit)        the relay (engine, service role) claims waiting rows (FOR UPDATE SKIP LOCKED) and gets them back.
--   * job_outbox_relayed(p_ids)        ... and marks them relayed once BullMQ holds them.
--   * job_outbox_release(p_ids, err)   ... or hands them back with the reason when Redis refused them.
--   * job_enqueue(...)                 generic producer for server code (service role only).
--   * knowledge_enqueue_source(...)    the business row (knowledge_sources, status 'queued') AND its outbox row in ONE transaction.
--   * knowledge_retry_source(p_source) re-enqueue a failed (or credit-blocked) source.
--   * storage bucket knowledge-uploads private; path '<workspaceId>/<uuid>/<filename>'; managers upload, only the service role reads.

/* ------------------------------------------------------------------ the outbox */

create table if not exists public.job_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  queue text not null check (queue ~ '^[a-z][a-z0-9_-]{0,62}$'),
  name text not null check (name ~ '^[a-z][a-z0-9_.-]{0,126}$'),
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique check (length(dedupe_key) between 1 and 300 and position(':' in dedupe_key) > 0),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  relayed_at timestamptz,
  attempts int not null default 0,
  last_error text
);

-- The relay's scan: rows not yet in BullMQ, oldest first.
create index if not exists job_outbox_waiting on public.job_outbox (created_at) where relayed_at is null;
create index if not exists job_outbox_ws on public.job_outbox (workspace_id, created_at desc);

alter table public.job_outbox enable row level security;
-- No policy: only the service role (which bypasses RLS) reads or writes the outbox.
revoke all on public.job_outbox from anon, authenticated;
grant all on public.job_outbox to service_role;

/** A claim older than this is considered abandoned (the relay died between claim and relayed) and is claimed again. */
create or replace function public.job_outbox_claim(p_limit int default 50)
returns setof public.job_outbox
language sql
security definer
set search_path = public
as $$
  update public.job_outbox o
     set claimed_at = now(), attempts = o.attempts + 1
   where o.id in (
     select w.id from public.job_outbox w
      where w.relayed_at is null
        and (w.claimed_at is null or w.claimed_at < now() - interval '30 seconds')
      order by w.created_at
      limit greatest(1, least(coalesce(p_limit, 50), 500))
      for update skip locked
   )
  returning o.*;
$$;

create or replace function public.job_outbox_relayed(p_ids uuid[])
returns int
language sql
security definer
set search_path = public
as $$
  with done as (
    update public.job_outbox set relayed_at = now(), last_error = null
     where id = any(p_ids) and relayed_at is null
    returning 1
  )
  select count(*)::int from done;
$$;

/** Redis refused the rows: release the claim so the next pass tries again, and keep the reason for operators. */
create or replace function public.job_outbox_release(p_ids uuid[], p_error text default null)
returns int
language sql
security definer
set search_path = public
as $$
  with back as (
    update public.job_outbox set claimed_at = null, last_error = left(p_error, 1000)
     where id = any(p_ids) and relayed_at is null
    returning 1
  )
  select count(*)::int from back;
$$;

/**
 * The generic producer for server code: one outbox row, idempotent on p_dedupe (an existing key returns the existing row id and adds nothing).
 * Service role only. Call it from an RPC that also writes the business row when the two must commit together.
 */
create or replace function public.job_enqueue(p_workspace uuid, p_queue text, p_name text, p_payload jsonb, p_dedupe text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.job_outbox (workspace_id, queue, name, payload, dedupe_key)
  values (p_workspace, p_queue, p_name, coalesce(p_payload, '{}'::jsonb), p_dedupe)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.job_outbox where dedupe_key = p_dedupe;
  end if;
  return v_id;
end $$;

revoke all on function public.job_outbox_claim(int) from public, anon, authenticated;
revoke all on function public.job_outbox_relayed(uuid[]) from public, anon, authenticated;
revoke all on function public.job_outbox_release(uuid[], text) from public, anon, authenticated;
revoke all on function public.job_enqueue(uuid, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.job_outbox_claim(int), public.job_outbox_relayed(uuid[]), public.job_outbox_release(uuid[], text),
  public.job_enqueue(uuid, text, text, jsonb, text) to service_role;

/* ------------------------------------------------------------------ knowledge_sources: background indexing */

-- Lifecycle: queued -> reading -> indexing -> extracting_facts -> ready | failed | blocked_credits.
-- 'pending' stays valid: rows written by the synchronous path before this migration (and any code still on it) keep their meaning.
alter table public.knowledge_sources drop constraint if exists knowledge_sources_status_check;
alter table public.knowledge_sources add constraint knowledge_sources_status_check
  check (status in ('pending', 'queued', 'reading', 'indexing', 'extracting_facts', 'ready', 'failed', 'blocked_credits'));

alter table public.knowledge_sources
  add column if not exists storage_path text,
  add column if not exists source_url text,
  add column if not exists origin text,
  add column if not exists progress int not null default 0,
  add column if not exists error text;

alter table public.knowledge_sources drop constraint if exists knowledge_sources_progress_check;
alter table public.knowledge_sources add constraint knowledge_sources_progress_check check (progress between 0 and 100);

-- Rows already indexed are complete.
update public.knowledge_sources set progress = 100 where status = 'ready' and progress = 0;

-- "Đang xử lý N tài liệu": the open work of a workspace.
create index if not exists knowledge_sources_open on public.knowledge_sources (workspace_id)
  where status in ('queued', 'reading', 'indexing', 'extracting_facts');

/**
 * Create a source and its knowledge.index job in ONE transaction. The caller must be an owner or manager of p_workspace (the service role
 * may call it for any workspace). Kinds:
 *   file  p_storage_path = '<workspace>/<uuid>/<filename>' in bucket knowledge-uploads (uploaded first by the browser)
 *   url   p_url = the link (also kept in content until the worker replaces it with the text, as the old synchronous path did)
 *   text / faq  p_meta->>'content' = the text
 * p_meta: { topic?, tags?: string[], visibility?: 'public'|'internal', module?, origin?, content? }. Returns the source id.
 */
create or replace function public.knowledge_enqueue_source(p_workspace uuid, p_kind text, p_title text, p_storage_path text, p_url text, p_meta jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
  v_id uuid;
  v_title text := left(btrim(coalesce(p_title, '')), 160);
  v_content text := '';
  v_tags text[];
  v_module text := nullif(btrim(coalesce(v_meta->>'module', '')), '');
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_manager(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_kind not in ('file', 'url', 'text', 'faq') then
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;
  if p_kind = 'file' then
    if p_storage_path is null or split_part(p_storage_path, '/', 1) <> p_workspace::text or p_storage_path like '%..%' then
      raise exception 'storage path must start with the workspace id' using errcode = '22023';
    end if;
    if v_title = '' then v_title := left(regexp_replace(regexp_replace(p_storage_path, '^.*/', ''), '\.[^.]+$', ''), 160); end if;
  elsif p_kind = 'url' then
    if p_url is null or p_url !~* '^https?://' then
      raise exception 'url must be http(s)' using errcode = '22023';
    end if;
    v_content := p_url;
    if v_title = '' then v_title := left(regexp_replace(p_url, '^https?://', ''), 160); end if;
  else
    v_content := btrim(coalesce(v_meta->>'content', ''));
    if v_content = '' then raise exception 'content is empty' using errcode = '22023'; end if;
    if v_title = '' then raise exception 'title is required' using errcode = '22023'; end if;
  end if;
  if v_module is not null and not exists (select 1 from public.modules where key = v_module) then v_module := null; end if;
  select coalesce(array_agg(distinct left(btrim(t), 40)) filter (where btrim(t) <> ''), '{}')
    into v_tags
    from jsonb_array_elements_text(case when jsonb_typeof(v_meta->'tags') = 'array' then v_meta->'tags' else '[]'::jsonb end) t;

  insert into public.knowledge_sources (workspace_id, module, kind, title, content, status, progress, topic, tags, visibility, storage_path, source_url, origin, created_by)
  values (
    p_workspace, v_module, p_kind, v_title, v_content, 'queued', 0,
    nullif(left(btrim(coalesce(v_meta->>'topic', '')), 80), ''), v_tags[1:12],
    case when v_meta->>'visibility' = 'public' then 'public' else 'internal' end,
    case when p_kind = 'file' then p_storage_path end,
    case when p_kind = 'url' then p_url end,
    nullif(left(btrim(coalesce(v_meta->>'origin', '')), 300), ''),
    auth.uid()
  )
  returning id into v_id;

  insert into public.job_outbox (workspace_id, queue, name, payload, dedupe_key)
  values (p_workspace, 'knowledge', 'knowledge.index', jsonb_build_object('sourceId', v_id, 'workspaceId', p_workspace), 'knowledge.index:' || v_id);

  return v_id;
end $$;

/** Re-enqueue a failed (or credit-blocked) source: status back to queued and a fresh knowledge.index job. Returns the source id. */
create or replace function public.knowledge_retry_source(p_source uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_status text;
begin
  select workspace_id, status into v_ws, v_status from public.knowledge_sources where id = p_source for update;
  if v_ws is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_manager(v_ws) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_status not in ('failed', 'blocked_credits') then
    return p_source; -- already queued, running or ready: nothing to do
  end if;
  update public.knowledge_sources set status = 'queued', progress = 0, error = null, updated_at = now() where id = p_source;
  insert into public.job_outbox (workspace_id, queue, name, payload, dedupe_key)
  values (v_ws, 'knowledge', 'knowledge.index', jsonb_build_object('sourceId', p_source, 'workspaceId', v_ws),
          'knowledge.index:' || p_source || ':retry:' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
  return p_source;
end $$;

revoke all on function public.knowledge_enqueue_source(uuid, text, text, text, text, jsonb) from public, anon;
revoke all on function public.knowledge_retry_source(uuid) from public, anon;
grant execute on function public.knowledge_enqueue_source(uuid, text, text, text, text, jsonb), public.knowledge_retry_source(uuid) to authenticated, service_role;

/* ------------------------------------------------------------------ uploads */

insert into storage.buckets (id, name, public, file_size_limit) values ('knowledge-uploads', 'knowledge-uploads', false, 12582912)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists knowledge_uploads_manager_insert on storage.objects;
-- Owners and managers upload under their workspace prefix ('<workspaceId>/<uuid>/<filename>'). No select/update/delete policy:
-- only the service role (the engine) reads the bytes.
create policy knowledge_uploads_manager_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'knowledge-uploads' and public.storage_ws_manager(name));

/* ------------------------------------------------------------------ realtime */

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'knowledge_sources') then
    alter publication supabase_realtime add table public.knowledge_sources;
  end if;
end $$;

-- Background jobs on Supabase Queues (pgmq) instead of Redis/BullMQ. A lite app runs on the monorepo + Supabase only. See docs/JOBS.md.
--
-- Design (replaces the outbox -> relay -> BullMQ path of 20261025100000_job_outbox.sql):
--   * job_enqueue writes the job_outbox row AND calls pgmq.send in the SAME transaction. There is no relay any more: a job is in the
--     queue exactly when its business row (knowledge_sources) commits, and not at all when that transaction rolls back.
--   * job_outbox stays, as the dedupe record (unique dedupe_key: enqueueing the same key twice sends ONE message) and the audit trail
--     (state queued -> running -> done | failed, attempts, last_error) that operators and the watchdog query with plain SQL.
--     pgmq has no dedupe of its own, and a dedupe column on knowledge_sources would not cover chained jobs (facts, reembed follow-ups).
--   * The engine polls with job_read (visibility timeout), extends the timeout with job_touch while a handler runs, and ends each message
--     with job_ack (done), job_fail (retry after a delay) or job_archive (failed for good). pgmq.read already skips locked rows, so several
--     engines never receive the same message at once.
--   * Per-workspace concurrency: job_read takes a slot in job_slots (an advisory lock per workspace serialises the count) and defers a
--     message whose workspace already runs p_ws_limit jobs by a few seconds, without counting an attempt. Slots carry a lease, so a crashed
--     engine frees them when the message's visibility timeout runs out.
--   * Attempts are counted in job_outbox.attempts when a message is really started (pgmq's read_ct also counts those deferrals).
-- Every RPC here is security definer and callable by the service role only (the engine); Supabase JS cannot call the pgmq schema directly.

create extension if not exists pgmq;

select pgmq.create('knowledge');

/* ------------------------------------------------------------------ job_outbox: dedupe + audit */

alter table public.job_outbox
  add column if not exists msg_id bigint,
  add column if not exists state text not null default 'queued',
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

alter table public.job_outbox drop constraint if exists job_outbox_state_check;
alter table public.job_outbox add constraint job_outbox_state_check check (state in ('queued', 'running', 'done', 'failed'));

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'job_outbox' and column_name = 'relayed_at') then
    alter table public.job_outbox rename column relayed_at to sent_at;
  end if;
end $$;
alter table public.job_outbox drop column if exists claimed_at;

drop index if exists public.job_outbox_waiting;
create index if not exists job_outbox_open on public.job_outbox (created_at) where state in ('queued', 'running');
create unique index if not exists job_outbox_msg on public.job_outbox (queue, msg_id) where msg_id is not null;
create index if not exists job_outbox_failed on public.job_outbox (finished_at desc) where state = 'failed';

drop function if exists public.job_outbox_claim(int);
drop function if exists public.job_outbox_relayed(uuid[]);
drop function if exists public.job_outbox_release(uuid[], text);

/* ------------------------------------------------------------------ per-workspace slots */

create table if not exists public.job_slots (
  queue text not null,
  msg_id bigint not null,
  workspace_id uuid not null,
  lease_until timestamptz not null,
  primary key (queue, msg_id)
);
create index if not exists job_slots_ws on public.job_slots (workspace_id);
alter table public.job_slots enable row level security;
revoke all on public.job_slots from anon, authenticated;
grant all on public.job_slots to service_role;

/* ------------------------------------------------------------------ producer */

/** The message body every consumer receives. */
create or replace function public.job_message(p_name text, p_payload jsonb, p_dedupe text, p_outbox uuid)
returns jsonb
language sql
immutable
as $$ select jsonb_build_object('name', p_name, 'payload', coalesce(p_payload, '{}'::jsonb), 'dedupe', p_dedupe, 'outbox_id', p_outbox) $$;

/**
 * The one producer: an outbox row and its pgmq message in the caller's transaction, idempotent on p_dedupe (an existing key returns the
 * existing row id and sends nothing). Service role only; SQL RPCs that must commit the job with a business row call it directly.
 */
create or replace function public.job_enqueue(p_workspace uuid, p_queue text, p_name text, p_payload jsonb, p_dedupe text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_msg bigint;
begin
  insert into public.job_outbox (workspace_id, queue, name, payload, dedupe_key)
  values (p_workspace, p_queue, p_name, coalesce(p_payload, '{}'::jsonb), p_dedupe)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.job_outbox where dedupe_key = p_dedupe;
    return v_id;
  end if;
  select pgmq.send(p_queue, public.job_message(p_name, p_payload, p_dedupe, v_id)) into v_msg;
  update public.job_outbox set msg_id = v_msg, sent_at = now() where id = v_id;
  return v_id;
end $$;

/* ------------------------------------------------------------------ consumer */

/**
 * Up to p_qty messages of p_queue, each invisible to other readers for p_vt seconds. A message whose workspace already runs p_ws_limit jobs
 * is deferred 3-4 s and not returned. `attempt` is 1 on the first real start.
 */
create or replace function public.job_read(p_queue text, p_vt int, p_qty int, p_ws_limit int default 2)
returns table (msg_id bigint, attempt int, enqueued_at timestamptz, message jsonb)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  r record;
  v_ws uuid;
  v_ws_text text;
  v_busy int;
  v_attempt int;
begin
  for r in select * from pgmq.read(p_queue, greatest(5, p_vt), greatest(1, least(p_qty, 100))) loop
    v_ws_text := r.message->'payload'->>'workspaceId';
    v_ws := case when v_ws_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_ws_text::uuid end;
    if v_ws is not null then
      perform pg_advisory_xact_lock(hashtextextended('nivo.job-ws:' || v_ws::text, 0));
      delete from public.job_slots s where s.workspace_id = v_ws and s.lease_until < now();
      select count(*) into v_busy from public.job_slots s where s.workspace_id = v_ws and not (s.queue = p_queue and s.msg_id = r.msg_id);
      if v_busy >= greatest(1, p_ws_limit) then
        perform pgmq.set_vt(p_queue, r.msg_id, 3 + floor(random() * 2)::int);
        continue;
      end if;
      insert into public.job_slots as s (queue, msg_id, workspace_id, lease_until)
      values (p_queue, r.msg_id, v_ws, now() + make_interval(secs => greatest(5, p_vt)))
      on conflict (queue, msg_id) do update set lease_until = excluded.lease_until;
    end if;
    v_attempt := null;
    update public.job_outbox o set attempts = o.attempts + 1, state = 'running', started_at = now()
     where o.queue = p_queue and o.msg_id = r.msg_id
    returning o.attempts into v_attempt;
    msg_id := r.msg_id;
    attempt := coalesce(v_attempt, r.read_ct);
    enqueued_at := r.enqueued_at;
    message := r.message;
    return next;
  end loop;
end $$;

/** Keep a running message invisible for p_vt more seconds (and its workspace slot leased as long). */
create or replace function public.job_touch(p_queue text, p_msg_id bigint, p_vt int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pgmq.set_vt(p_queue, p_msg_id, greatest(0, p_vt));
  update public.job_slots set lease_until = now() + make_interval(secs => greatest(5, p_vt)) where queue = p_queue and msg_id = p_msg_id;
  return found;
end $$;

/** Done: delete the message, free the slot, close the outbox row. */
create or replace function public.job_ack(p_queue text, p_msg_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  v_ok := pgmq.delete(p_queue, p_msg_id);
  delete from public.job_slots where queue = p_queue and msg_id = p_msg_id;
  update public.job_outbox set state = 'done', finished_at = now(), last_error = null where queue = p_queue and msg_id = p_msg_id;
  return coalesce(v_ok, false);
end $$;

/** Retry later: the message becomes visible again after p_delay_s seconds; the slot is freed meanwhile. */
create or replace function public.job_fail(p_queue text, p_msg_id bigint, p_delay_s int, p_error text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pgmq.set_vt(p_queue, p_msg_id, greatest(0, p_delay_s));
  delete from public.job_slots where queue = p_queue and msg_id = p_msg_id;
  update public.job_outbox set state = 'queued', last_error = left(p_error, 1000) where queue = p_queue and msg_id = p_msg_id;
  return true;
end $$;

/** Failed for good (attempts used up or a permanent error): the message moves to the queue's archive, the outbox row keeps the reason. */
create or replace function public.job_archive(p_queue text, p_msg_id bigint, p_error text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  v_ok := pgmq.archive(p_queue, p_msg_id);
  delete from public.job_slots where queue = p_queue and msg_id = p_msg_id;
  update public.job_outbox set state = 'failed', finished_at = now(), last_error = left(p_error, 1000) where queue = p_queue and msg_id = p_msg_id;
  return coalesce(v_ok, false);
end $$;

/** Operators: send a failed outbox row again (a new message, attempts reset). Returns the new message id, null when the row is not failed. */
create or replace function public.job_requeue(p_outbox uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.job_outbox;
  v_msg bigint;
begin
  select * into o from public.job_outbox where id = p_outbox and state = 'failed' for update;
  if o.id is null then return null; end if;
  select pgmq.send(o.queue, public.job_message(o.name, o.payload, o.dedupe_key, o.id)) into v_msg;
  update public.job_outbox set msg_id = v_msg, sent_at = now(), state = 'queued', attempts = 0, finished_at = null where id = o.id;
  return v_msg;
end $$;

/** Health and the watchdog: per queue depth and age (pgmq.metrics), jobs running, failed in the last 24 h, the oldest open outbox row. */
create or replace function public.job_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'queues', coalesce((
      select jsonb_object_agg(q.queue_name, jsonb_build_object(
        'depth', m.queue_length, 'oldestAgeSeconds', coalesce(m.oldest_msg_age_sec, 0), 'total', m.total_messages))
        from pgmq.list_queues() q cross join lateral pgmq.metrics(q.queue_name) m), '{}'::jsonb),
    'running', (select count(*) from public.job_slots where lease_until > now()),
    'failed24h', (select count(*) from public.job_outbox where state = 'failed' and finished_at > now() - interval '24 hours'),
    'oldestQueuedAgeSeconds', coalesce((select extract(epoch from now() - min(created_at))::int from public.job_outbox where state = 'queued'), 0),
    'checkedAt', now()
  );
$$;

revoke all on function public.job_message(text, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.job_enqueue(uuid, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.job_read(text, int, int, int) from public, anon, authenticated;
revoke all on function public.job_touch(text, bigint, int) from public, anon, authenticated;
revoke all on function public.job_ack(text, bigint) from public, anon, authenticated;
revoke all on function public.job_fail(text, bigint, int, text) from public, anon, authenticated;
revoke all on function public.job_archive(text, bigint, text) from public, anon, authenticated;
revoke all on function public.job_requeue(uuid) from public, anon, authenticated;
revoke all on function public.job_stats() from public, anon, authenticated;
grant execute on function public.job_enqueue(uuid, text, text, jsonb, text), public.job_read(text, int, int, int), public.job_touch(text, bigint, int),
  public.job_ack(text, bigint), public.job_fail(text, bigint, int, text), public.job_archive(text, bigint, text), public.job_requeue(uuid),
  public.job_stats() to service_role;

/* ------------------------------------------------------------------ knowledge RPCs: send through job_enqueue */

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

  perform public.job_enqueue(p_workspace, 'knowledge', 'knowledge.index', jsonb_build_object('sourceId', v_id, 'workspaceId', p_workspace), 'knowledge.index:' || v_id);
  return v_id;
end $$;

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
  perform public.job_enqueue(v_ws, 'knowledge', 'knowledge.index', jsonb_build_object('sourceId', p_source, 'workspaceId', v_ws),
          'knowledge.index:' || p_source || ':retry:' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
  return p_source;
end $$;

/* ------------------------------------------------------------------ rows written before this migration */

-- Outbox rows the relay never sent go straight into the queue.
do $$
declare
  o record;
  v_msg bigint;
begin
  for o in select * from public.job_outbox where sent_at is null and msg_id is null order by created_at loop
    select pgmq.send(o.queue, public.job_message(o.name, o.payload, o.dedupe_key, o.id)) into v_msg;
    update public.job_outbox set msg_id = v_msg, sent_at = now() where id = o.id;
  end loop;
end $$;
-- Rows already handed to BullMQ: their fate is unknown here; leave them as history.
update public.job_outbox set state = 'done', finished_at = coalesce(finished_at, sent_at) where msg_id is null and sent_at is not null and state = 'queued';

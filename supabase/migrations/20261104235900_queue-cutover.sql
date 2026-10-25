-- Expand before the BullMQ contract migration. Only job queues are drained; the event bus stays on pgmq.
-- Keep the empty queues and redirect late legacy sends, including cron commands already executing at cutover.
-- All adoption, fencing and deletion below commits atomically. A bad envelope or conflicting identity aborts it.
SET LOCAL lock_timeout = '15s';
LOCK TABLE public.job_outbox, public.job_slots, public.jobs IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.job_outbox ADD COLUMN IF NOT EXISTS run_lease_until timestamptz;

CREATE FUNCTION public.job_cutover_adopt(
    p_queue text, p_msg_id bigint, p_enqueued_at timestamptz, p_message jsonb,
    p_attempt integer, p_visible_at timestamptz, p_archived boolean
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_name text := coalesce(p_message->>'name', p_queue);
  v_payload jsonb := coalesce(p_message->'payload', '{}'::jsonb);
  v_dedupe text := coalesce(nullif(p_message->>'dedupe', ''), 'pgmq-cutover:' || p_queue || ':' || p_msg_id);
  v_workspace uuid;
  v_existing public.job_outbox;
begin
  if p_message->>'outbox_id' is not null then
    v_id := (p_message->>'outbox_id')::uuid;
  end if;
  select * into v_existing from public.job_outbox o
  where (v_id is not null and o.id = v_id) or (o.queue = p_queue and o.msg_id = p_msg_id)
  order by (o.id = v_id) desc nulls last limit 1;
  if v_existing.id is null then
    select * into v_existing from public.job_outbox o where o.dedupe_key = v_dedupe;
  end if;
  if v_existing.id is not null then
    if (v_id is not null and v_id <> v_existing.id)
       or v_existing.queue <> p_queue or v_existing.name <> v_name or v_existing.payload <> v_payload then
      raise exception 'Conflicting pgmq cutover identity in queue %, message %', p_queue, p_msg_id;
    end if;
    v_id := v_existing.id;
    if not p_archived and v_existing.state in ('queued', 'running') then
      update public.job_outbox set sent_at = null,
        run_lease_until = greatest(run_lease_until, case when p_attempt > 0 then p_visible_at end)
      where id = v_id;
    end if;
  else
    v_id := coalesce(v_id, md5('nivo.pgmq-cutover:' || p_queue || ':' || p_msg_id)::uuid);
    if v_payload->>'workspaceId' is not null then
      v_workspace := (v_payload->>'workspaceId')::uuid;
    end if;
    insert into public.job_outbox
      (id, workspace_id, queue, name, payload, dedupe_key, created_at, msg_id, state, attempts,
       started_at, finished_at, last_error, run_lease_until)
    values
      (v_id, v_workspace, p_queue, v_name, v_payload, v_dedupe, p_enqueued_at, p_msg_id,
       case when p_archived then 'failed' when p_attempt > 0 then 'running' else 'queued' end,
       greatest(p_attempt, 0), case when p_attempt > 0 then p_enqueued_at end,
       case when p_archived then now() end,
       case when p_archived then 'Migrated pgmq dead letter; original envelope retained in pgmq archive' end,
       case when not p_archived and p_attempt > 0 then p_visible_at end);
  end if;
  -- Raw ticks used queue:msg_id as their fenced key. Keep their existing claim and progress under the new delivery id.
  if p_message->>'outbox_id' is null then
    update public.jobs set job_key = v_id::text
    where kind in (v_name, p_queue) and job_key = p_queue || ':' || p_msg_id;
  end if;
  return v_id;
end $$;

REVOKE EXECUTE ON FUNCTION public.job_cutover_adopt(text, bigint, timestamptz, jsonb, integer, timestamptz, boolean)
FROM PUBLIC, anon, authenticated, app_be;

-- Old producers switch first. The following contract migration installs this same outbox-only entry point.
CREATE OR REPLACE FUNCTION public.job_enqueue(p_workspace uuid, p_queue text, p_name text, p_payload jsonb, p_dedupe text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  insert into public.job_outbox (workspace_id, queue, name, payload, dedupe_key)
  values (p_workspace, p_queue, p_name, coalesce(p_payload, '{}'::jsonb), p_dedupe)
  on conflict (dedupe_key) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.job_outbox where dedupe_key = p_dedupe; end if;
  return v_id;
end $$;

-- Fence legacy consumers while their already-running fenced claims settle. They cannot ack a newly migrated delivery.
CREATE OR REPLACE FUNCTION public.job_read(p_queue text, p_vt integer, p_qty integer, p_ws_limit integer DEFAULT 2)
    RETURNS TABLE(msg_id bigint, attempt integer, enqueued_at timestamptz, message jsonb)
    LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
    AS $$ select null::bigint, null::integer, null::timestamptz, null::jsonb where false $$;
CREATE OR REPLACE FUNCTION public.job_ack(p_queue text, p_msg_id bigint) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$ select false $$;
CREATE OR REPLACE FUNCTION public.job_touch(p_queue text, p_msg_id bigint, p_vt integer) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$ select false $$;
CREATE OR REPLACE FUNCTION public.job_fail(p_queue text, p_msg_id bigint, p_delay_s integer, p_error text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$ select false $$;
CREATE OR REPLACE FUNCTION public.job_archive(p_queue text, p_msg_id bigint, p_error text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$ select false $$;

-- An old function already executing may still write its pgmq sent marker after the redirect trigger returns.
CREATE FUNCTION public.job_cutover_legacy_marker() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $$
begin
  if new.msg_id is not null then
    new.msg_id := null;
    new.sent_at := null;
  end if;
  return new;
end $$;
REVOKE EXECUTE ON FUNCTION public.job_cutover_legacy_marker() FROM PUBLIC, anon, authenticated, app_be;
CREATE TRIGGER job_cutover_legacy_marker BEFORE UPDATE OF msg_id ON public.job_outbox
FOR EACH ROW EXECUTE FUNCTION public.job_cutover_legacy_marker();

CREATE FUNCTION public.job_cutover_redirect() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $$
begin
  perform public.job_cutover_adopt(TG_ARGV[0], new.msg_id, new.enqueued_at, new.message, new.read_ct, new.vt, false);
  execute format('delete from %I.%I where msg_id = $1', TG_TABLE_SCHEMA, TG_TABLE_NAME) using new.msg_id;
  return new;
end $$;
REVOKE EXECUTE ON FUNCTION public.job_cutover_redirect() FROM PUBLIC, anon, authenticated, app_be;

DO $$
declare
  q record;
  m record;
  v_id uuid;
begin
  for q in
    select queue_name from pgmq.list_queues() p
    where p.queue_name = any(array[
      'accounting_desk', 'agents', 'automation', 'bank_credit_received', 'booking_status', 'chat_turn',
      'connection_commands', 'connection_health', 'content_tick', 'data_sync', 'decisions', 'hiring_tick',
      'inventory_order', 'inventory_replenish', 'invite_command', 'knowledge', 'lead_actions', 'lead_gen',
      'marketing_tick', 'meta_inbound', 'n8n', 'payment_order_requested', 'public_api', 'render_request',
      'shifts_alerts', 'video_render', 'zalo_authorization', 'zalo_refresh', 'zalo_wizard',
      'meta-delivery', 'telegram-delivery', 'zalo-delivery', 'sepay-delivery', 'vietcombank-delivery', 'bank-feed-delivery'
    ]) or exists (select 1 from public.job_outbox o where o.queue = p.queue_name)
    order by queue_name
  loop
    execute format('lock table pgmq.%I, pgmq.%I in access exclusive mode', 'q_' || q.queue_name, 'a_' || q.queue_name);
    for m in execute format('select * from pgmq.%I order by msg_id', 'q_' || q.queue_name) loop
      v_id := public.job_cutover_adopt(q.queue_name, m.msg_id, m.enqueued_at, m.message, m.read_ct, m.vt, false);
      if not exists (select 1 from public.job_outbox o where o.id = v_id) then raise exception 'Unmigrated pgmq job % in %', m.msg_id, q.queue_name; end if;
    end loop;
    for m in execute format('select * from pgmq.%I order by msg_id', 'a_' || q.queue_name) loop
      v_id := public.job_cutover_adopt(q.queue_name, m.msg_id, m.enqueued_at, m.message, m.read_ct, m.vt, true);
      if not exists (select 1 from public.job_outbox o where o.id = v_id) then raise exception 'Unmigrated pgmq job % in %', m.msg_id, q.queue_name; end if;
    end loop;
    execute format('delete from pgmq.%I', 'q_' || q.queue_name);
    execute format('create trigger job_cutover_redirect after insert on pgmq.%I for each row execute function public.job_cutover_redirect(%L)',
      'q_' || q.queue_name, q.queue_name);
  end loop;
  update public.job_outbox set sent_at = null where state in ('queued', 'running');
end $$;

-- The redefined entry points stay backend-only.
REVOKE EXECUTE ON FUNCTION public.job_enqueue(uuid, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_enqueue(uuid, text, text, jsonb, text) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_read(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_read(text, integer, integer, integer) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_ack(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_ack(text, bigint) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_touch(text, bigint, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_touch(text, bigint, integer) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_fail(text, bigint, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_fail(text, bigint, integer, text) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_archive(text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_archive(text, bigint, text) TO app_be;

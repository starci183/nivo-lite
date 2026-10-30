-- BullMQ transports jobs; PostgreSQL remains the durable, fenced source of truth.
-- The preceding cutover migration adopts pgmq rows before the old functions are dropped below.

ALTER TABLE public.job_outbox ADD COLUMN IF NOT EXISTS run_lease_until timestamptz;
ALTER TABLE public.job_outbox ADD COLUMN run_token uuid;
ALTER TABLE public.job_outbox ADD COLUMN relay_lease_until timestamptz;
ALTER TABLE public.job_outbox ADD COLUMN lease_token uuid;
ALTER TABLE public.job_outbox ADD COLUMN retry_requested_at timestamptz;
ALTER TABLE public.job_outbox ADD COLUMN reconcile_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.job_outbox ADD COLUMN reconcile_checks integer NOT NULL DEFAULT 0;

-- Preserve old workspace slots and in-flight leases while changing their identity to the canonical outbox id.
ALTER TABLE public.job_slots ADD COLUMN job_id uuid;
UPDATE public.job_slots s SET job_id = o.id FROM public.job_outbox o WHERE o.queue = s.queue AND o.msg_id = s.msg_id;
UPDATE public.job_outbox o SET run_lease_until = greatest(o.run_lease_until, s.lease_until)
FROM public.job_slots s WHERE o.id = s.job_id;
DELETE FROM public.job_slots WHERE job_id IS NULL AND lease_until <= now();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.job_slots WHERE job_id IS NULL) THEN
    RAISE EXCEPTION 'Queue cutover has an unmapped live workspace slot';
  END IF;
END $$;
ALTER TABLE public.job_slots DROP CONSTRAINT job_slots_pkey;
ALTER TABLE public.job_slots DROP COLUMN msg_id;
ALTER TABLE public.job_slots ALTER COLUMN job_id SET NOT NULL;
ALTER TABLE public.job_slots ADD CONSTRAINT job_slots_pkey PRIMARY KEY (queue, job_id);
-- No legacy pgmq sent marker proves that Redis received the corresponding job.
UPDATE public.job_outbox SET sent_at = NULL, msg_id = NULL WHERE state IN ('queued', 'running');

CREATE OR REPLACE FUNCTION public.job_enqueue(p_workspace uuid, p_queue text, p_name text, p_payload jsonb, p_dedupe text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare v_id uuid;
begin
  insert into public.job_outbox (workspace_id, queue, name, payload, dedupe_key)
  values (p_workspace, p_queue, p_name, coalesce(p_payload, '{}'::jsonb), p_dedupe)
  on conflict (dedupe_key) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.job_outbox where dedupe_key = p_dedupe; end if;
  return v_id;
end $$;

-- A single statement locks, leases and commits before any Redis command. Round-robin ranks bound each queue's share.
CREATE FUNCTION public.job_relay_claim(p_limit integer, p_lease_s integer DEFAULT 60)
    RETURNS TABLE(id uuid, queue text, name text, payload jsonb, lease_token uuid, retry_requested boolean)
    LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  with candidates as materialized (
    select o.id, row_number() over (partition by o.queue order by o.created_at, o.id) as position
    from public.job_outbox o
    where o.sent_at is null and o.state in ('queued', 'running')
      and coalesce(o.relay_lease_until, '-infinity'::timestamptz) <= now()
  ), picked as (
    select o.id from public.job_outbox o join candidates c on c.id = o.id
    where o.sent_at is null and o.state in ('queued', 'running')
      and coalesce(o.relay_lease_until, '-infinity'::timestamptz) <= now()
    order by c.position, o.created_at, o.queue, o.id
    limit least(greatest(coalesce(p_limit, 50), 1), 500) for update of o skip locked
  ), claimed as (
    update public.job_outbox o set lease_token = gen_random_uuid(),
      relay_lease_until = now() + make_interval(secs => greatest(30, p_lease_s))
    from picked p where o.id = p.id returning o.*
  )
  select o.id, o.queue, o.name, o.payload, o.lease_token, o.retry_requested_at is not null from claimed o
$$;

CREATE FUNCTION public.job_relay_sent(p_id uuid, p_token uuid, p_stale_s integer DEFAULT 15) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  update public.job_outbox o set sent_at = now(), retry_requested_at = null,
    relay_lease_until = null, lease_token = null, reconcile_checks = 0,
    reconcile_at = now() + make_interval(secs => greatest(5, p_stale_s))
  where o.id = p_id and o.lease_token = p_token and o.relay_lease_until > now();
  return found;
end $$;

CREATE FUNCTION public.job_relay_release(p_id uuid, p_token uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  update public.job_outbox o set relay_lease_until = null, lease_token = null
  where o.id = p_id and o.lease_token = p_token and o.relay_lease_until > now();
  return found;
end $$;

-- Every check advances reconcile_at, including waiting/delayed/active/error rows. Replicas claim disjoint rows.
CREATE FUNCTION public.job_reconcile(p_stale_s integer, p_running_stale_s integer, p_limit integer, p_lease_s integer DEFAULT 60)
    RETURNS TABLE(id uuid, queue text, name text, payload jsonb, state text, attempts integer, run_token uuid, lease_token uuid, retry_requested boolean)
    LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  with candidates as materialized (
    select o.id, row_number() over (partition by o.queue order by o.reconcile_at, o.id) as position
    from public.job_outbox o
    where o.reconcile_at <= now()
      and coalesce(o.relay_lease_until, '-infinity'::timestamptz) <= now()
      and ((o.state = 'queued' and o.sent_at is not null)
        or (o.state = 'running' and coalesce(o.run_lease_until, '-infinity'::timestamptz) <= now()
          and coalesce(o.started_at, o.sent_at, o.created_at) < now() - make_interval(secs => greatest(5, p_running_stale_s))))
  ), picked as (
    select o.id from public.job_outbox o join candidates c on c.id = o.id
    where o.reconcile_at <= now() and o.state in ('queued', 'running')
      and coalesce(o.relay_lease_until, '-infinity'::timestamptz) <= now()
    order by c.position, o.reconcile_at, o.queue, o.id
    limit least(greatest(coalesce(p_limit, 50), 1), 500) for update of o skip locked
  ), claimed as (
    update public.job_outbox o set lease_token = gen_random_uuid(),
      relay_lease_until = now() + make_interval(secs => greatest(30, p_lease_s)),
      reconcile_at = now() + make_interval(secs => least(600, greatest(5, p_stale_s) * power(2, least(o.reconcile_checks, 7)))::int),
      reconcile_checks = least(o.reconcile_checks + 1, 8)
    from picked p where o.id = p.id returning o.*
  )
  select o.id, o.queue, o.name, o.payload, o.state, o.attempts, o.run_token, o.lease_token, o.retry_requested_at is not null from claimed o
$$;

-- Only done/failed are terminal. A live running lease defers; a lapsed lease admits a recovered real start.
CREATE FUNCTION public.job_start(p_queue text, p_id uuid, p_ws_limit integer, p_lease_s integer)
    RETURNS TABLE(outcome text, attempt integer, state text, run_token uuid)
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare o public.job_outbox; v_ws uuid; v_busy int; v_attempt int; v_until timestamptz; v_token uuid;
begin
  select * into o from public.job_outbox r where r.id = p_id and r.queue = p_queue for update;
  if o.id is null then return query select 'missing'::text, 0, 'missing'::text, null::uuid; return; end if;
  if o.state in ('done', 'failed') then return query select 'terminal'::text, o.attempts, o.state, o.run_token; return; end if;
  if o.state = 'running' and o.run_lease_until > now() then
    return query select 'busy'::text, o.attempts, o.state, o.run_token; return;
  end if;
  v_ws := o.workspace_id;
  v_until := now() + make_interval(secs => greatest(5, p_lease_s));
  if v_ws is not null then
    perform pg_advisory_xact_lock(hashtextextended('nivo.job-ws:' || v_ws::text, 0));
    delete from public.job_slots s where s.workspace_id = v_ws and s.lease_until < now();
    select count(*) into v_busy from public.job_slots s where s.workspace_id = v_ws and s.job_id <> o.id;
    if v_busy >= greatest(1, p_ws_limit) then return query select 'busy'::text, o.attempts, o.state, o.run_token; return; end if;
    insert into public.job_slots as s (queue, job_id, workspace_id, lease_until)
    values (o.queue, o.id, v_ws, v_until)
    on conflict on constraint job_slots_pkey do update set lease_until = excluded.lease_until;
  end if;
  update public.job_outbox r set attempts = r.attempts + 1, state = 'running', started_at = now(), run_lease_until = v_until, run_token = gen_random_uuid()
  where r.id = o.id returning r.attempts, r.run_token into v_attempt, v_token;
  return query select 'started'::text, v_attempt, 'running'::text, v_token;
end $$;

-- Every worker settlement is fenced by a unique admission token independent of retry and handback counts; old holders cannot settle a recovered delivery.
CREATE FUNCTION public.job_lease(p_id uuid, p_lease_s integer, p_token uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  update public.job_outbox o set run_lease_until = now() + make_interval(secs => greatest(5, p_lease_s))
  where o.id = p_id and o.state = 'running' and o.run_token = p_token;
  if not found then return false; end if;
  update public.job_slots set lease_until = now() + make_interval(secs => greatest(5, p_lease_s)) where job_id = p_id;
  return true;
end $$;

CREATE FUNCTION public.job_done(p_id uuid, p_token uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  update public.job_outbox o set state = 'done', finished_at = now(), last_error = null, run_lease_until = null
  where o.id = p_id and o.state = 'running' and o.run_token = p_token;
  if not found then return false; end if;
  delete from public.job_slots where job_id = p_id;
  return true;
end $$;

CREATE FUNCTION public.job_retry(p_id uuid, p_error text, p_token uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  update public.job_outbox o set state = 'queued', last_error = left(coalesce(p_error, ''), 1000), run_lease_until = null
  where o.id = p_id and o.state = 'running' and o.run_token = p_token;
  if not found then return false; end if;
  delete from public.job_slots where job_id = p_id;
  return true;
end $$;

CREATE FUNCTION public.job_dead(p_id uuid, p_error text, p_token uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  update public.job_outbox o set state = 'failed', finished_at = now(), last_error = left(coalesce(p_error, ''), 1000), run_lease_until = null
  where o.id = p_id and o.state = 'running' and o.run_token = p_token;
  if not found then return false; end if;
  delete from public.job_slots where job_id = p_id;
  return true;
end $$;

CREATE FUNCTION public.job_handback(p_id uuid, p_token uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  update public.job_outbox o set state = 'queued', attempts = greatest(0, o.attempts - 1), run_lease_until = null
  where o.id = p_id and o.state = 'running' and o.run_token = p_token;
  if not found then return false; end if;
  delete from public.job_slots where job_id = p_id;
  return true;
end $$;

CREATE FUNCTION public.job_reset(p_id uuid, p_token uuid, p_run_token uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  update public.job_outbox o set state = 'queued', run_lease_until = null
  where o.id = p_id and o.lease_token = p_token and o.relay_lease_until > now() and o.run_token is not distinct from p_run_token
    and o.state in ('queued', 'running') and coalesce(o.run_lease_until, '-infinity'::timestamptz) <= now();
  if not found then return false; end if;
  delete from public.job_slots where job_id = p_id;
  return true;
end $$;

DROP FUNCTION public.job_requeue(uuid);
CREATE FUNCTION public.job_reopen(p_outbox uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare o public.job_outbox;
begin
  select * into o from public.job_outbox where id = p_outbox and state = 'failed' for update;
  if o.id is null then return null; end if;
  delete from public.job_slots where job_id = o.id;
  update public.job_outbox set msg_id = null, sent_at = null, state = 'queued', attempts = 0, finished_at = null,
    run_lease_until = null, relay_lease_until = null, lease_token = null,
    retry_requested_at = now(), reconcile_at = now(), reconcile_checks = 0 where id = o.id;
  return o.id;
end $$;

CREATE OR REPLACE FUNCTION public.job_requeue_failed(p_hours integer DEFAULT 24) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare r record; v_failed integer := 0; v_requeued integer := 0;
begin
  for r in select o.id from public.job_outbox o where o.state = 'failed'
    and o.finished_at >= now() - make_interval(hours => least(greatest(coalesce(p_hours, 24), 1), 720)) order by o.finished_at
  loop
    v_failed := v_failed + 1;
    if public.job_reopen(r.id) is not null then v_requeued := v_requeued + 1; end if;
  end loop;
  return jsonb_build_object('requeued', v_requeued, 'failed', v_failed);
end $$;

-- 13. The stats the operators read: the durable record says how many wait, run and failed, since pgmq's per-queue
--     metrics no longer describe the broker.
CREATE OR REPLACE FUNCTION public.job_stats() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'queues', coalesce((
      select jsonb_object_agg(o.queue, jsonb_build_object(
        'depth', o.n, 'oldestAgeSeconds', o.oldest, 'total', o.n))
      from (select o.queue, count(*)::int as n,
                   coalesce(extract(epoch from now() - min(o.created_at))::int, 0) as oldest
            from public.job_outbox o
            where o.state = 'queued'
            group by o.queue) o), '{}'::jsonb),
    'unsent', (select count(*) from public.job_outbox where state = 'queued' and sent_at is null),
    'running', (select count(*) from public.job_outbox where state = 'running'),
    'failed24h', (select count(*) from public.job_outbox where state = 'failed' and finished_at > now() - interval '24 hours'),
    'oldestQueuedAgeSeconds', coalesce((select extract(epoch from now() - min(created_at))::int from public.job_outbox where state = 'queued'), 0),
    'checkedAt', now()
  );
$$;

-- Refuse the destructive contract step unless every job queue was drained and its late-send bridge is installed.
DO $$
DECLARE q record; pending bigint;
BEGIN
  FOR q IN
    SELECT p.queue_name FROM pgmq.list_queues() p
    WHERE p.queue_name = ANY(ARRAY[
      'accounting_desk','agents','automation','bank_credit_received','booking_status','chat_turn',
      'connection_commands','connection_health','content_tick','data_sync','decisions','hiring_tick',
      'inventory_order','inventory_replenish','invite_command','knowledge','lead_actions','lead_gen',
      'marketing_tick','meta_inbound','n8n','payment_order_requested','public_api','render_request',
      'shifts_alerts','video_render','zalo_authorization','zalo_refresh','zalo_wizard','meta-delivery',
      'telegram-delivery','zalo-delivery','sepay-delivery','vietcombank-delivery','bank-feed-delivery'])
      OR EXISTS (SELECT 1 FROM public.job_outbox o WHERE o.queue = p.queue_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid = to_regclass(format('pgmq.%I', 'q_' || q.queue_name))
        AND t.tgname = 'job_cutover_redirect' AND NOT t.tgisinternal AND t.tgenabled <> 'D'
    ) THEN
      RAISE EXCEPTION 'Queue cutover expand migration must run before contract: %', q.queue_name;
    END IF;
    EXECUTE format('select count(*) from pgmq.%I', 'q_' || q.queue_name) INTO pending;
    IF pending <> 0 THEN RAISE EXCEPTION 'Unmigrated pgmq jobs remain in %', q.queue_name; END IF;
  END LOOP;
END $$;

-- Every drained job queue leaves pgmq: the broker of a job queue is BullMQ on Redis, so the empty pgmq
-- table and its late-send redirect go away with it. The event-bus queues are not in this list and stay.
SELECT pgmq.drop_queue('accounting_desk') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'accounting_desk');
SELECT pgmq.drop_queue('agents') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'agents');
SELECT pgmq.drop_queue('automation') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'automation');
SELECT pgmq.drop_queue('bank_credit_received') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'bank_credit_received');
SELECT pgmq.drop_queue('booking_status') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'booking_status');
SELECT pgmq.drop_queue('chat_turn') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'chat_turn');
SELECT pgmq.drop_queue('connection_commands') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'connection_commands');
SELECT pgmq.drop_queue('connection_health') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'connection_health');
SELECT pgmq.drop_queue('content_tick') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'content_tick');
SELECT pgmq.drop_queue('data_sync') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'data_sync');
SELECT pgmq.drop_queue('decisions') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'decisions');
SELECT pgmq.drop_queue('hiring_tick') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'hiring_tick');
SELECT pgmq.drop_queue('inventory_order') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'inventory_order');
SELECT pgmq.drop_queue('inventory_replenish') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'inventory_replenish');
SELECT pgmq.drop_queue('invite_command') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'invite_command');
SELECT pgmq.drop_queue('knowledge') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'knowledge');
SELECT pgmq.drop_queue('lead_actions') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'lead_actions');
SELECT pgmq.drop_queue('lead_gen') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'lead_gen');
SELECT pgmq.drop_queue('marketing_tick') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'marketing_tick');
SELECT pgmq.drop_queue('meta_inbound') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'meta_inbound');
SELECT pgmq.drop_queue('n8n') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'n8n');
SELECT pgmq.drop_queue('payment_order_requested') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'payment_order_requested');
SELECT pgmq.drop_queue('public_api') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'public_api');
SELECT pgmq.drop_queue('render_request') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'render_request');
SELECT pgmq.drop_queue('shifts_alerts') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'shifts_alerts');
SELECT pgmq.drop_queue('video_render') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'video_render');
SELECT pgmq.drop_queue('zalo_authorization') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'zalo_authorization');
SELECT pgmq.drop_queue('zalo_refresh') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'zalo_refresh');
SELECT pgmq.drop_queue('zalo_wizard') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'zalo_wizard');
SELECT pgmq.drop_queue('meta-delivery') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'meta-delivery');
SELECT pgmq.drop_queue('telegram-delivery') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'telegram-delivery');
SELECT pgmq.drop_queue('zalo-delivery') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'zalo-delivery');
SELECT pgmq.drop_queue('sepay-delivery') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'sepay-delivery');
SELECT pgmq.drop_queue('vietcombank-delivery') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'vietcombank-delivery');
SELECT pgmq.drop_queue('bank-feed-delivery') WHERE EXISTS (SELECT 1 FROM pgmq.list_queues() q WHERE q.queue_name = 'bank-feed-delivery');

-- The cutover has drained live pgmq job tables before this contract step; event-bus pgmq functions stay.
DROP FUNCTION public.job_read(text, integer, integer, integer);
DROP FUNCTION public.job_touch(text, bigint, integer);
DROP FUNCTION public.job_ack(text, bigint);
DROP FUNCTION public.job_fail(text, bigint, integer, text);
DROP FUNCTION public.job_archive(text, bigint, text);
DROP FUNCTION public.job_message(text, jsonb, text, uuid);

CREATE INDEX job_outbox_pending ON public.job_outbox (created_at) WHERE sent_at IS NULL AND state IN ('queued', 'running');
CREATE INDEX job_outbox_reconcile_due ON public.job_outbox (reconcile_at, queue) WHERE state IN ('queued', 'running');

-- 16. The recurring ticks write their occurrence to the outbox on the same schedules, queues and job names; the
--     dedupe key pins one row per scheduled minute so a replayed tick cannot double-run.


-- Backend-only definer functions.
REVOKE EXECUTE ON FUNCTION public.job_relay_claim(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_relay_claim(integer, integer) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_relay_sent(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_relay_sent(uuid, uuid, integer) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_relay_release(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_relay_release(uuid, uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_reconcile(integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_reconcile(integer, integer, integer, integer) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_start(text, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_start(text, uuid, integer, integer) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_lease(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_lease(uuid, integer, uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_done(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_done(uuid, uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_retry(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_retry(uuid, text, uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_dead(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_dead(uuid, text, uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_handback(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_handback(uuid, uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_reset(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_reset(uuid, uuid, uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_reopen(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_reopen(uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_requeue_failed(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_requeue_failed(integer) TO app_be;

REVOKE EXECUTE ON FUNCTION public.job_enqueue(uuid, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_enqueue(uuid, text, text, jsonb, text) TO app_be;
REVOKE EXECUTE ON FUNCTION public.job_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_stats() TO app_be;

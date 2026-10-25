-- The queue moves its transport from pgmq to BullMQ on Redis. The outbox stays the durable record: job_enqueue now
-- only inserts the row (the relay publishes it to Redis under the row id after the commit), job_start admits a
-- delivery while taking the workspace slot, and job_done / job_retry / job_dead close it. job_slots leases by the
-- outbox id instead of a pgmq message id, and every pg_cron tick writes its occurrence to the outbox instead of
-- pgmq.send, on the same schedules and the same queue and job names.

-- 1. The slots lease by the durable job id now.
DELETE FROM public.job_slots;
ALTER TABLE public.job_slots DROP CONSTRAINT job_slots_pkey;
ALTER TABLE public.job_slots DROP COLUMN msg_id;
ALTER TABLE public.job_slots ADD COLUMN job_id uuid;
ALTER TABLE public.job_slots ALTER COLUMN job_id SET NOT NULL;
ALTER TABLE public.job_slots ADD CONSTRAINT job_slots_pkey PRIMARY KEY (queue, job_id);

-- 2. The producer path only writes the durable row; publishing is the relay's job.
CREATE OR REPLACE FUNCTION public.job_enqueue(p_workspace uuid, p_queue text, p_name text, p_payload jsonb, p_dedupe text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

-- 3. The relay reads and locks the oldest committed rows that wait for the broker, so two relays cannot hand the
--    same row to Redis twice in the same pass.
CREATE FUNCTION public.job_relay_claim(p_limit integer) RETURNS TABLE(id uuid, queue text, name text, payload jsonb)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select o.id, o.queue, o.name, o.payload
  from public.job_outbox o
  where o.sent_at is null and o.state = 'queued'
  order by o.created_at
  limit least(greatest(coalesce(p_limit, 50), 1), 500)
  for update of o skip locked
$$;

-- 4. The relay marks the rows it just handed to the broker, in the transaction that locked them.
CREATE FUNCTION public.job_relay_sent(p_ids uuid[]) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.job_outbox set sent_at = now() where id = any(p_ids) and sent_at is null
$$;

-- 5. The relay's repair set: queued rows that were sent but saw no delivery for a while, and running rows whose
--    lease and broker lock have long expired (their worker is gone).
CREATE FUNCTION public.job_reconcile(p_stale_s integer, p_running_stale_s integer, p_limit integer)
    RETURNS TABLE(id uuid, queue text, name text, payload jsonb, state text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select o.id, o.queue, o.name, o.payload, o.state
  from public.job_outbox o
  where (o.state = 'queued' and o.sent_at is not null and o.sent_at < now() - make_interval(secs => greatest(5, p_stale_s)))
     or (o.state = 'running' and coalesce(o.started_at, o.sent_at, o.created_at) < now() - make_interval(secs => greatest(60, p_running_stale_s)))
  order by o.created_at
  limit least(greatest(coalesce(p_limit, 50), 1), 500)
$$;

-- 6. A worker admits the durable row the broker job names: it counts the real start and takes the workspace slot,
--    or it refuses with the reason the worker acts on (busy, terminal, missing).
CREATE FUNCTION public.job_start(p_queue text, p_id uuid, p_ws_limit integer, p_lease_s integer)
    RETURNS TABLE(outcome text, attempt integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  o public.job_outbox;
  v_ws uuid;
  v_busy int;
  v_attempt int;
begin
  select * into o from public.job_outbox where id = p_id and queue = p_queue for update;
  if o.id is null then
    return query select 'missing'::text, 0;
    return;
  end if;
  if o.state <> 'queued' then
    return query select 'terminal'::text, 0;
    return;
  end if;
  v_ws := o.workspace_id;
  if v_ws is not null then
    perform pg_advisory_xact_lock(hashtextextended('nivo.job-ws:' || v_ws::text, 0));
    delete from public.job_slots s where s.workspace_id = v_ws and s.lease_until < now();
    select count(*) into v_busy from public.job_slots s where s.workspace_id = v_ws and s.job_id <> o.id;
    if v_busy >= greatest(1, p_ws_limit) then
      return query select 'busy'::text, o.attempts;
      return;
    end if;
    insert into public.job_slots as s (queue, job_id, workspace_id, lease_until)
    values (o.queue, o.id, v_ws, now() + make_interval(secs => greatest(5, p_lease_s)))
    on conflict on constraint job_slots_pkey do update set lease_until = excluded.lease_until;
  end if;
  update public.job_outbox r set attempts = r.attempts + 1, state = 'running', started_at = now()
   where r.id = o.id
  returning r.attempts into v_attempt;
  return query select 'started'::text, coalesce(v_attempt, 1);
end $_$;

-- 7. A running handler renews its workspace slot; losing the row ends the renewal quietly.
CREATE FUNCTION public.job_lease(p_id uuid, p_lease_s integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.job_slots set lease_until = now() + make_interval(secs => greatest(5, p_lease_s)) where job_id = p_id;
  return found;
end $$;

-- 8. A delivery closes its row done and frees the workspace slot.
CREATE FUNCTION public.job_done(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from public.job_slots where job_id = p_id;
  update public.job_outbox set state = 'done', finished_at = now(), last_error = null where id = p_id;
  return found;
end $$;

-- 9. A delivery that may run again goes back to queued; the broker holds the retry pause.
CREATE FUNCTION public.job_retry(p_id uuid, p_error text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from public.job_slots where job_id = p_id;
  update public.job_outbox set state = 'queued', last_error = left(coalesce(p_error, ''), 1000) where id = p_id and state = 'running';
  return found;
end $$;

-- 10. A delivery that cannot or may not run again ends failed; the broker keeps the failed job for operators.
CREATE FUNCTION public.job_dead(p_id uuid, p_error text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from public.job_slots where job_id = p_id;
  update public.job_outbox set state = 'failed', finished_at = now(), last_error = left(coalesce(p_error, ''), 1000) where id = p_id and state <> 'done';
  return found;
end $$;

-- 11. The relay puts a running row it recovered back to queued; the delivery that claimed it is gone.
CREATE FUNCTION public.job_reset(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from public.job_slots where job_id = p_id;
  update public.job_outbox set state = 'queued' where id = p_id and state = 'running';
  return found;
end $$;

-- 12. An operator retry clears the sent marker so the relay publishes the row to the broker again under the same id.
DROP FUNCTION public.job_requeue_failed(integer);
DROP FUNCTION public.job_requeue(uuid);
CREATE FUNCTION public.job_requeue(p_outbox uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  o public.job_outbox;
begin
  select * into o from public.job_outbox where id = p_outbox and state = 'failed' for update;
  if o.id is null then return null; end if;
  delete from public.job_slots where job_id = o.id;
  update public.job_outbox set msg_id = null, sent_at = null, state = 'queued', attempts = 0, finished_at = null where id = o.id;
  return o.id;
end $$;

CREATE FUNCTION public.job_requeue_failed(p_hours integer DEFAULT 24) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r record;
  v_failed integer := 0;
  v_requeued integer := 0;
begin
  for r in
    select o.id from public.job_outbox o
    where o.state = 'failed' and o.finished_at >= now() - make_interval(hours => least(greatest(coalesce(p_hours, 24), 1), 720))
    order by o.finished_at
  loop
    v_failed := v_failed + 1;
    if public.job_requeue(r.id) is not null then v_requeued := v_requeued + 1; end if;
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

-- 14. The pgmq reads are gone: the broker delivers, the outbox settles. job_message built the pgmq envelope;
--     the operator reads (job_status, job_failed, job_open) only read the outbox and stay.
DROP FUNCTION public.job_read(text, integer, integer, integer);
DROP FUNCTION public.job_touch(text, bigint, integer);
DROP FUNCTION public.job_ack(text, bigint);
DROP FUNCTION public.job_fail(text, bigint, integer, text);
DROP FUNCTION public.job_archive(text, bigint, text);
DROP FUNCTION public.job_message(text, jsonb, text, uuid);

-- 15. The relay claim and the reconciliation ride on one index each.
CREATE INDEX job_outbox_pending ON public.job_outbox (created_at) WHERE sent_at IS NULL AND state = 'queued';
CREATE INDEX job_outbox_running_started ON public.job_outbox (started_at) WHERE state = 'running';

-- 16. The recurring ticks write their occurrence to the outbox on the same schedules, queues and job names; the
--     dedupe key pins one row per scheduled minute so a replayed tick cannot double-run.
SELECT cron.unschedule('agents-sync-all');
SELECT cron.schedule('agents-sync-all', '*/5 * * * *', $cron$SELECT public.job_enqueue(NULL::uuid, 'agents', 'agents.sync', '{}'::jsonb, 'agents-sync-all:' || date_trunc('minute', clock_timestamp()))$cron$);
SELECT cron.unschedule('automation-tick');
SELECT cron.schedule('automation-tick', '*/1 * * * *', $cron$SELECT public.job_enqueue(NULL::uuid, 'automation', 'automation.tick', '{}'::jsonb, 'automation-tick:' || date_trunc('minute', clock_timestamp()))$cron$);
SELECT cron.unschedule('connection-health-tick');
SELECT cron.schedule('connection-health-tick', '*/15 * * * *', $cron$SELECT public.job_enqueue(NULL::uuid, 'connection_health', 'connection_health', '{"silentAfterHours":72}'::jsonb, 'connection-health-tick:' || date_trunc('minute', clock_timestamp()))$cron$);
SELECT cron.unschedule('content-tick');
SELECT cron.schedule('content-tick', '*/15 * * * *', $cron$SELECT public.job_enqueue(NULL::uuid, 'content_tick', 'content_tick', '{}'::jsonb, 'content-tick:' || date_trunc('minute', clock_timestamp()))$cron$);
SELECT cron.unschedule('data-sync-tick');
SELECT cron.schedule('data-sync-tick', '*/1 * * * *', $cron$SELECT public.job_enqueue(NULL::uuid, 'data_sync', 'data_sync', '{"tick":true}'::jsonb, 'data-sync-tick:' || date_trunc('minute', clock_timestamp()))$cron$);
SELECT cron.unschedule('decisions-drain-work');
SELECT cron.schedule('decisions-drain-work', '*/1 * * * *', $cron$SELECT public.job_enqueue(NULL::uuid, 'decisions', 'decisions.drain-work', '{}'::jsonb, 'decisions-drain-work:' || date_trunc('minute', clock_timestamp()))$cron$);
SELECT cron.unschedule('shifts-tick');
SELECT cron.schedule('shifts-tick', '*/1 * * * *', $cron$SELECT public.job_enqueue(NULL::uuid, 'shifts_alerts', 'shifts.tick', '{"kind":"tick"}'::jsonb, 'shifts-tick:' || date_trunc('minute', clock_timestamp()))$cron$);
SELECT cron.unschedule('zalo-refresh-tick');
SELECT cron.schedule('zalo-refresh-tick', '0 */6 * * *', $cron$SELECT public.job_enqueue(NULL::uuid, 'zalo_refresh', 'zalo_refresh', '{"withinMs":25200000}'::jsonb, 'zalo-refresh-tick:' || date_trunc('minute', clock_timestamp()))$cron$);
SELECT cron.unschedule('accounting-desk-morning');
SELECT cron.schedule('accounting-desk-morning', '30 23 * * *', $cron$SELECT public.job_enqueue(NULL::uuid, 'accounting_desk', 'accounting_desk.morning', '{}'::jsonb, 'accounting-desk-morning:' || date_trunc('minute', clock_timestamp()))$cron$);
SELECT cron.unschedule('marketing-tick');
SELECT cron.schedule('marketing-tick', '*/15 * * * *', $cron$SELECT public.job_enqueue(NULL::uuid, 'marketing_tick', 'marketing_tick', '{}'::jsonb, 'marketing-tick:' || date_trunc('minute', clock_timestamp()))$cron$);
SELECT cron.unschedule('decisions-expire-approvals');
SELECT cron.schedule('decisions-expire-approvals', '*/1 * * * *', $cron$SELECT public.job_enqueue(NULL::uuid, 'decisions', 'decisions.expire-approvals', '{}'::jsonb, 'decisions-expire-approvals:' || date_trunc('minute', clock_timestamp()))$cron$);

-- 17. The grants: app_be reaches the queue only through these definer functions.
REVOKE EXECUTE ON FUNCTION public.job_relay_claim(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_relay_sent(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_reconcile(integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_start(text, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_lease(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_done(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_retry(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_dead(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_reset(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_requeue(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_requeue_failed(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_relay_claim(integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_relay_sent(uuid[]) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_reconcile(integer, integer, integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_start(text, uuid, integer, integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_lease(uuid, integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_done(uuid) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_retry(uuid, text) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_dead(uuid, text) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_reset(uuid) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_requeue(uuid) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_requeue_failed(integer) TO app_be;

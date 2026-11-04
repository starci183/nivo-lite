-- delayed-jobs-and-turn-debounce: a job can wait before the broker runs it. Expand only. job_outbox gets run_after (null means now);
-- job_enqueue gains an overload with a delay in milliseconds, written only when the row is first inserted so a repeat of the same dedupe key
-- never moves it; the relay and the reconciler read the remaining delay (delay_ms), which the broker honours as its own delay, through
-- job_relay_claim_with_delay and job_reconcile_with_delay: new doors beside the old ones, so the release before this one keeps calling
-- job_relay_claim and job_reconcile unchanged until a contract migration drops them. The four-argument agent_turn_begin becomes the door
-- of the debounced turn with no window; the windowed turn itself is 20261111101900 and 20261111102010 (stamped after them: this
-- migration was first written with the invalid stamp 20261111101160 and never ran on a shared database).

ALTER TABLE public.job_outbox ADD COLUMN IF NOT EXISTS run_after timestamptz;

CREATE FUNCTION public.job_enqueue(p_workspace uuid, p_queue text, p_name text, p_payload jsonb, p_dedupe text, p_delay_ms integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare v_id uuid;
begin
  insert into public.job_outbox (workspace_id, queue, name, payload, dedupe_key, run_after)
  values (p_workspace, p_queue, p_name, coalesce(p_payload, '{}'::jsonb), p_dedupe,
          case when coalesce(p_delay_ms, 0) > 0 then now() + make_interval(secs => p_delay_ms / 1000.0) end)
  on conflict (dedupe_key) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.job_outbox where dedupe_key = p_dedupe; end if;
  return v_id;
end $$;
REVOKE EXECUTE ON FUNCTION public.job_enqueue(uuid, text, text, jsonb, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_enqueue(uuid, text, text, jsonb, text, integer) TO app_be;

CREATE FUNCTION public.job_relay_claim_with_delay(p_limit integer, p_lease_s integer DEFAULT 60)
    RETURNS TABLE(id uuid, queue text, name text, payload jsonb, lease_token uuid, retry_requested boolean, delay_ms integer)
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
  select o.id, o.queue, o.name, o.payload, o.lease_token, o.retry_requested_at is not null, greatest(0, ceil(extract(epoch from (coalesce(o.run_after, now()) - now())) * 1000))::integer from claimed o
$$;
REVOKE EXECUTE ON FUNCTION public.job_relay_claim_with_delay(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_relay_claim_with_delay(integer, integer) TO app_be;

CREATE FUNCTION public.job_reconcile_with_delay(p_stale_s integer, p_running_stale_s integer, p_limit integer, p_lease_s integer DEFAULT 60)
    RETURNS TABLE(id uuid, queue text, name text, payload jsonb, state text, attempts integer, run_token uuid, lease_token uuid, retry_requested boolean, delay_ms integer)
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
  select o.id, o.queue, o.name, o.payload, o.state, o.attempts, o.run_token, o.lease_token, o.retry_requested_at is not null, greatest(0, ceil(extract(epoch from (coalesce(o.run_after, now()) - now())) * 1000))::integer from claimed o
$$;
REVOKE EXECUTE ON FUNCTION public.job_reconcile_with_delay(integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_reconcile_with_delay(integer, integer, integer, integer) TO app_be;

-- The four-argument door keeps answering as before: no window.
CREATE OR REPLACE FUNCTION public.agent_turn_begin(p_agent uuid, p_scope text, p_owner text, p_lease_s integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN public.agent_turn_begin(p_agent, p_scope, p_owner, p_lease_s, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.agent_turn_begin(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_turn_begin(uuid, text, text, integer) TO app_be;

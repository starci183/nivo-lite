-- delayed-jobs-and-turn-debounce: a job can wait before the broker runs it, and a burst of customer messages in one conversation is one turn.
-- Expand only. job_outbox gets run_after (null means now); job_enqueue gains an overload with a delay in milliseconds, written only when the
-- row is first inserted so a repeat of the same dedupe key never moves it; the relay and the reconciler read the remaining delay (delay_ms),
-- which the broker honours as its own delay. agent_turn_begin gains a debounce window: a wake of a conversation scope that still has a newer
-- wake inside the window waits (that newer wake has its own delayed drain), and when it runs it takes every pending wake of the scope
-- into one turn, recording their message ids on the wake it begins. A window of zero is the old behaviour, and the four-argument function keeps
-- its signature and answers as before.

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

DROP FUNCTION public.job_relay_claim(integer, integer);
CREATE FUNCTION public.job_relay_claim(p_limit integer, p_lease_s integer DEFAULT 60)
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
REVOKE EXECUTE ON FUNCTION public.job_relay_claim(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_relay_claim(integer, integer) TO app_be;

DROP FUNCTION public.job_reconcile(integer, integer, integer, integer);
CREATE FUNCTION public.job_reconcile(p_stale_s integer, p_running_stale_s integer, p_limit integer, p_lease_s integer DEFAULT 60)
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
REVOKE EXECUTE ON FUNCTION public.job_reconcile(integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_reconcile(integer, integer, integer, integer) TO app_be;

CREATE FUNCTION public.agent_turn_begin(p_agent uuid, p_scope text, p_owner text, p_lease_s integer, p_window_ms integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_workspace uuid;
  v_lease public.agent_work_leases%ROWTYPE;
  v_wake public.agent_wakes%ROWTYPE;
  v_turn_id uuid;
  v_proposal jsonb;
  v_fence bigint;
  v_ended jsonb := '[]'::jsonb;
  v_merged text;
BEGIN
  SELECT a.workspace_id INTO v_workspace FROM public.agents a WHERE a.id = p_agent;
  IF v_workspace IS NULL THEN
    RETURN jsonb_build_object('result', 'idle', 'ended', v_ended);
  END IF;
  INSERT INTO public.agent_work_state (agent_id, workspace_id) VALUES (p_agent, v_workspace) ON CONFLICT (agent_id) DO NOTHING;
  IF public.agent_work_is_off(p_agent, v_workspace) THEN
    WITH held AS (
      UPDATE public.agent_wakes w SET status = 'held', reason = 'killed'
       WHERE w.agent_id = p_agent AND w.scope_key = p_scope AND w.status = 'pending' RETURNING w.*
    )
    SELECT COALESCE(jsonb_agg(public.agent_wake_ended(ROW(h.*)::public.agent_wakes, 'held')), '[]'::jsonb) INTO v_ended FROM held h;
    -- A turn whose worker crashed before the switch is taken over here too, or its lease would lapse for the sweep to drain again every minute.
    SELECT * INTO v_lease FROM public.agent_work_leases l WHERE l.agent_id = p_agent AND l.scope_key = p_scope FOR UPDATE;
    IF FOUND AND v_lease.running_turn_id IS NOT NULL AND v_lease.lease_until <= now() THEN
      UPDATE public.agent_turns t SET status = 'abandoned' WHERE t.id = v_lease.running_turn_id AND t.status IN ('running', 'proposed');
      WITH crashed AS (
        UPDATE public.agent_wakes w SET status = 'held', reason = 'killed'
         WHERE w.status = 'running' AND w.id = (SELECT t.wake_id FROM public.agent_turns t WHERE t.id = v_lease.running_turn_id) RETURNING w.*
      )
      SELECT v_ended || COALESCE(jsonb_agg(public.agent_wake_ended(ROW(c.*)::public.agent_wakes, 'held')), '[]'::jsonb) INTO v_ended FROM crashed c;
      UPDATE public.agent_work_leases l SET running_turn_id = NULL, lease_until = NULL, lease_owner = NULL
       WHERE l.agent_id = p_agent AND l.scope_key = p_scope;
    END IF;
    RETURN jsonb_build_object('result', 'killed', 'ended', v_ended);
  END IF;
  INSERT INTO public.agent_work_leases (agent_id, scope_key, workspace_id) VALUES (p_agent, p_scope, v_workspace)
    ON CONFLICT (agent_id, scope_key) DO NOTHING;
  SELECT * INTO v_lease FROM public.agent_work_leases l WHERE l.agent_id = p_agent AND l.scope_key = p_scope FOR UPDATE;
  IF v_lease.running_turn_id IS NOT NULL AND v_lease.lease_until > now() THEN
    RETURN jsonb_build_object('result', 'busy');
  END IF;
  IF v_lease.running_turn_id IS NOT NULL THEN
    UPDATE public.agent_turns t SET status = 'abandoned' WHERE t.id = v_lease.running_turn_id AND t.status = 'running';
    UPDATE public.agent_wakes w SET status = 'pending', not_before = now()
     WHERE w.status = 'running' AND w.id = (SELECT t.wake_id FROM public.agent_turns t WHERE t.id = v_lease.running_turn_id);
  END IF;
  LOOP
    SELECT * INTO v_wake FROM public.agent_wakes w
     WHERE w.agent_id = p_agent AND w.scope_key = p_scope AND w.status = 'pending' AND w.not_before <= now()
     ORDER BY w.priority, w.created_at LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN
      UPDATE public.agent_work_leases l SET running_turn_id = NULL, lease_until = NULL, lease_owner = NULL
       WHERE l.agent_id = p_agent AND l.scope_key = p_scope;
      RETURN jsonb_build_object('result', 'idle', 'ended', v_ended);
    END IF;
    EXIT WHEN v_wake.attempts < v_wake.max_attempts;
    UPDATE public.agent_wakes w SET status = 'dead', reason = 'attempts', finished_at = now() WHERE w.id = v_wake.id;
    v_ended := v_ended || jsonb_build_array(public.agent_wake_ended(v_wake, 'dead'));
  END LOOP;
  -- The burst window: a wake of a conversation scope with a newer wake of the scope inside the window waits (the newer wake has its own delayed
  -- drain, a little earlier than the window to absorb clock skew); when it runs it takes every pending wake of the scope into one turn.
  IF p_window_ms > 0 AND p_scope LIKE 'conversation:%' THEN
    IF EXISTS (
      SELECT 1 FROM public.agent_wakes w
       WHERE w.agent_id = p_agent AND w.scope_key = p_scope AND w.status = 'pending'
         AND w.created_at > now() - make_interval(secs => greatest(p_window_ms - 500, 0) / 1000.0)
    ) THEN
      RETURN jsonb_build_object('result', 'idle', 'ended', v_ended);
    END IF;
    WITH merged AS (
      UPDATE public.agent_wakes w SET status = 'skipped', reason = 'coalesced', finished_at = now()
       WHERE w.agent_id = p_agent AND w.scope_key = p_scope AND w.status = 'pending'
         AND w.id <> v_wake.id AND w.not_before <= now()
       RETURNING w.created_at, w.context ->> 'messageId' AS message_id
    )
    SELECT string_agg(m.message_id, ',' ORDER BY m.created_at) INTO v_merged FROM merged m WHERE m.message_id IS NOT NULL;
    IF v_merged IS NOT NULL THEN
      v_wake.context := v_wake.context || jsonb_build_object('mergedMessageIds', v_merged);
      UPDATE public.agent_wakes w SET context = v_wake.context WHERE w.id = v_wake.id;
    END IF;
  END IF;
  UPDATE public.agent_wakes w SET status = 'running', attempts = w.attempts + 1, started_at = COALESCE(w.started_at, now())
   WHERE w.id = v_wake.id;
  v_fence := v_lease.fence + 1;
  SELECT t.id, t.proposal INTO v_turn_id, v_proposal FROM public.agent_turns t
   WHERE t.wake_id = v_wake.id AND t.status = 'proposed' ORDER BY t.fence DESC LIMIT 1;
  IF v_turn_id IS NULL THEN
    INSERT INTO public.agent_turns (workspace_id, agent_id, wake_id, fence, status)
      VALUES (v_workspace, p_agent, v_wake.id, v_fence, 'running') RETURNING id INTO v_turn_id;
  ELSE
    UPDATE public.agent_turns t SET fence = v_fence WHERE t.id = v_turn_id;
  END IF;
  UPDATE public.agent_work_leases l
     SET fence = v_fence, lease_owner = p_owner, lease_until = now() + make_interval(secs => p_lease_s), running_turn_id = v_turn_id
   WHERE l.agent_id = p_agent AND l.scope_key = p_scope;
  RETURN jsonb_build_object(
    'result', 'begun',
    'workspaceId', v_workspace,
    'fence', v_fence,
    'turnId', v_turn_id,
    'wakeId', v_wake.id,
    'source', v_wake.source,
    'eventKey', v_wake.event_key,
    'context', v_wake.context,
    'actorMemberId', v_wake.actor_member_id,
    'attempts', v_wake.attempts + 1,
    'maxAttempts', v_wake.max_attempts,
    'wakeCreatedAt', v_wake.created_at,
    'proposal', v_proposal,
    'ended', v_ended
  );
END;
$$;
REVOKE ALL ON FUNCTION public.agent_turn_begin(uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_turn_begin(uuid, text, text, integer, integer) TO app_be;

-- The four-argument door keeps answering as before: no window.
CREATE OR REPLACE FUNCTION public.agent_turn_begin(p_agent uuid, p_scope text, p_owner text, p_lease_s integer) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT public.agent_turn_begin(p_agent, p_scope, p_owner, p_lease_s, 0) $$;

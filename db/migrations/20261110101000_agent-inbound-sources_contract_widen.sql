-- agent-inbound: a wake's source is the key of the adapter that normalized the fact, so the closed list of four sources becomes a key
-- shape. What a source means to the work core (priority, attempts, background) is declared by the adapter and stored on the wake: a wake
-- carries `background` so the day's cap no longer reads a source name. An event trigger may name the sources it answers to; none answers
-- to every source. Widening only: the four old sources stay valid, no wake changes its source, and the two old background sources keep
-- spending the cap whether or not a writer set the new column.

ALTER TABLE public.agent_wakes DROP CONSTRAINT agent_wakes_source_check;
ALTER TABLE public.agent_wakes
    ADD CONSTRAINT agent_wakes_source_check CHECK (source ~ '^[a-z][a-z0-9_]{0,39}$');

ALTER TABLE public.agent_wakes ADD COLUMN background boolean NOT NULL DEFAULT false;
UPDATE public.agent_wakes SET background = true WHERE source IN ('internal', 'schedule');

ALTER TABLE public.agent_triggers ADD COLUMN sources text[] NOT NULL DEFAULT '{}'::text[];

-- The same function as before; the only change is that a background turn is read from the wake's own flag.
CREATE OR REPLACE FUNCTION public.agent_turn_finish(
    p_agent uuid, p_scope text, p_fence bigint, p_turn uuid, p_status text, p_reason text, p_outcome jsonb, p_error_code text,
    p_usage jsonb, p_retry_wait_s integer, p_breaker_after integer, p_breaker_s integer
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_lease public.agent_work_leases%ROWTYPE;
  v_turn public.agent_turns%ROWTYPE;
  v_wake public.agent_wakes%ROWTYPE;
  v_wake_status text;
  v_turn_status text;
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_more boolean;
  v_failed boolean;
  v_answered boolean;
  v_spends boolean;
BEGIN
  SELECT * INTO v_lease FROM public.agent_work_leases l WHERE l.agent_id = p_agent AND l.scope_key = p_scope FOR UPDATE;
  IF NOT FOUND OR v_lease.fence <> p_fence OR v_lease.running_turn_id IS DISTINCT FROM p_turn THEN
    RETURN jsonb_build_object('fenced', true, 'more', false);
  END IF;
  SELECT * INTO v_turn FROM public.agent_turns t WHERE t.id = p_turn FOR UPDATE;
  SELECT * INTO v_wake FROM public.agent_wakes w WHERE w.id = v_turn.wake_id FOR UPDATE;
  IF p_status = 'failed' THEN
    v_wake_status := CASE WHEN v_wake.attempts >= v_wake.max_attempts THEN 'dead' ELSE 'pending' END;
  ELSE
    v_wake_status := p_status;
  END IF;
  v_turn_status := CASE
    WHEN p_status <> 'failed' THEN 'settled'
    WHEN v_wake_status = 'pending' AND v_turn.proposal IS NOT NULL THEN 'proposed'
    ELSE 'failed'
  END;
  UPDATE public.agent_turns t SET
      status = v_turn_status,
      outcome = p_outcome,
      error_code = p_error_code,
      model = p_usage ->> 'model',
      prompt_tokens = (p_usage ->> 'promptTokens')::integer,
      completion_tokens = (p_usage ->> 'completionTokens')::integer,
      cost = (p_usage ->> 'cost')::numeric,
      duration_ms = (p_usage ->> 'durationMs')::integer
   WHERE t.id = p_turn;
  UPDATE public.agent_wakes w SET
      status = v_wake_status,
      reason = p_reason,
      not_before = CASE WHEN v_wake_status = 'pending' THEN now() + make_interval(secs => p_retry_wait_s) ELSE w.not_before END,
      finished_at = CASE WHEN v_wake_status = 'pending' THEN NULL ELSE now() END
   WHERE w.id = v_wake.id;
  -- A failure is a failed turn, or a customer's wake ended by the holding line after an error (p_error_code set). The breaker closes only on a
  -- turn the model really answered (a stored proposal): a hold-over, a skip or a turn with no model run says nothing about the runtime. A
  -- background turn spends the day's cap whether it was done or failed, since the model may have run either way.
  v_failed := p_status = 'failed' OR p_error_code IS NOT NULL;
  v_answered := p_status = 'done' AND p_error_code IS NULL AND v_turn.proposal IS NOT NULL;
  v_spends := (v_wake.background OR v_wake.source IN ('internal', 'schedule')) AND (v_failed OR p_status = 'done');
  UPDATE public.agent_work_state s SET
      failures = CASE WHEN v_failed THEN s.failures + 1 WHEN v_answered THEN 0 ELSE s.failures END,
      breaker_until = CASE
        WHEN v_failed AND s.failures + 1 >= p_breaker_after THEN now() + make_interval(secs => p_breaker_s)
        WHEN v_answered THEN NULL
        ELSE s.breaker_until END,
      last_turn_at = now(),
      background_turns = CASE
        WHEN NOT v_spends THEN s.background_turns
        WHEN s.background_day = v_today THEN s.background_turns + 1
        ELSE 1 END,
      background_day = CASE WHEN v_spends THEN v_today ELSE s.background_day END
   WHERE s.agent_id = p_agent;
  -- A task wake that was skipped (quota, cap) must not end the task: the wake cleared the task's time, so it is armed again for an hour on.
  IF p_status = 'skipped' AND v_wake.context ->> 'taskId' IS NOT NULL THEN
    UPDATE public.agent_tasks t SET next_action_at = now() + interval '1 hour'
     WHERE t.id = (v_wake.context ->> 'taskId')::uuid AND t.status = 'open' AND t.next_action_at IS NULL;
  END IF;
  UPDATE public.agent_work_leases l SET running_turn_id = NULL, lease_until = NULL, lease_owner = NULL
   WHERE l.agent_id = p_agent AND l.scope_key = p_scope;
  SELECT EXISTS (
    SELECT 1 FROM public.agent_wakes w
     WHERE w.agent_id = p_agent AND w.scope_key = p_scope AND w.status = 'pending' AND w.not_before <= now()
  ) INTO v_more;
  RETURN jsonb_build_object('fenced', false, 'more', v_more);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.agent_turn_finish(uuid, text, bigint, uuid, text, text, jsonb, text, jsonb, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_turn_finish(uuid, text, bigint, uuid, text, text, jsonb, text, jsonb, integer, integer, integer) TO app_be;

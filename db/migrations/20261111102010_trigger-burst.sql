-- trigger-burst: the flow of an agent sets the burst of its conversations. The window and the longest wait a wake takes are resolved once,
-- when the wake is written (from the trigger of the agent's live flow, else the app's defaults), and kept on the wake; agent_turn_begin reads
-- them from the wake it is about to run and falls back to its arguments for a wake that carries none. Expand only.

ALTER TABLE public.agent_wakes ADD COLUMN burst_window_ms integer CHECK (burst_window_ms IS NULL OR burst_window_ms >= 0);
ALTER TABLE public.agent_wakes ADD COLUMN burst_max_ms integer CHECK (burst_max_ms IS NULL OR burst_max_ms >= 0);

CREATE OR REPLACE FUNCTION public.agent_turn_begin(p_agent uuid, p_scope text, p_owner text, p_lease_s integer, p_window_ms integer, p_max_ms integer) RETURNS jsonb
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
  v_context jsonb;
  v_window integer;
  v_max integer;
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
  -- The sliding burst window: a wake of a conversation scope with a newer wake of the scope inside the window waits (the newer wake has its own
  -- delayed drain, a little earlier than the window to absorb clock skew), so every new message extends the wait by the window; a burst whose
  -- first message is older than p_max_ms stops waiting. When the turn runs it takes every pending wake of the scope into one.
  v_window := COALESCE(v_wake.burst_window_ms, p_window_ms);
  v_max := COALESCE(v_wake.burst_max_ms, p_max_ms);
  IF v_window > 0 AND p_scope LIKE 'conversation:%' THEN
    IF EXISTS (
      SELECT 1 FROM public.agent_wakes w
       WHERE w.agent_id = p_agent AND w.scope_key = p_scope AND w.status = 'pending'
         AND w.created_at > now() - make_interval(secs => greatest(v_window - 500, 0) / 1000.0)
    ) AND v_wake.created_at > now() - make_interval(secs => greatest(v_max, v_window) / 1000.0) THEN
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
      UPDATE public.agent_wakes w SET context = w.context || jsonb_build_object('mergedMessageIds', v_merged)
        WHERE w.id = v_wake.id RETURNING w.context INTO v_context;
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
    'context', coalesce(v_context, v_wake.context),
    'actorMemberId', v_wake.actor_member_id,
    'attempts', v_wake.attempts + 1,
    'maxAttempts', v_wake.max_attempts,
    'wakeCreatedAt', v_wake.created_at,
    'proposal', v_proposal,
    'ended', v_ended
  );
END;
$$;
REVOKE ALL ON FUNCTION public.agent_turn_begin(uuid, text, text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_turn_begin(uuid, text, text, integer, integer, integer) TO app_be;

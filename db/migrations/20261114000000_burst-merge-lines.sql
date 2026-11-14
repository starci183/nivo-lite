-- burst-merge-lines: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the DECOUPLE lane: RESTART-R applies it.
-- REWRITTEN IN PLACE 2026-11-14 (ROAD Opus-1, the one event pipeline, ROAD-API section 5; the file was never applied on any database).
-- EDITED IN PLACE again 2026-11-14 (ROAD Opus-1c, owner rule R28): the settle time comes ONLY from the source's declaration, written on
-- the wake; the app's window arguments are gone. ONE function is left: public.agent_turn_begin(uuid, text, text, integer); the baseline's
-- five- and six-argument forms (and the four-argument wrapper over them) are dropped, no table touched. What changes against the
-- baseline (20261111101900_sliding-burst-window.sql):
--   1. THE SETTLE TIME is the source's: a scope whose oldest pending wake carries a window (`burst_window_ms`, written from the
--      `settle` of the trigger declaration that delivered the event) starts its turn only once the scope has been quiet for that window,
--      at most the longest wait (`burst_max_ms`) after that wake. Any lock scope; a wake with no window of its own runs at once.
--   2. NO MERGE: no wake is folded into another (`mergedMessageIds`, `mergedLinesJson`, the `isStart` / `resume` barrier and the `coalesced`
--      skip are gone). The turn begins the OLDEST pending wake of the scope; the wakes that came with it stay pending and the run's first
--      step takes them as its queue (`run.queue`), which closes them `queued:<run>` (agent-work `claimQueued`).
DROP FUNCTION IF EXISTS public.agent_turn_begin(uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.agent_turn_begin(uuid, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.agent_turn_begin(uuid, text, text, integer, integer, integer);

CREATE FUNCTION public.agent_turn_begin(p_agent uuid, p_scope text, p_owner text, p_lease_s integer) RETURNS jsonb
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
  -- The settle time (ROAD-API section 5): the window the oldest pending wake carries (its source's declaration), else none. While a newer wake of the scope came inside the window (it has its own delayed drain, a little earlier
  -- than the window to absorb clock skew) and the oldest is not older than the longest wait, the scope is not quiet yet: nothing begins.
  -- No wake is merged: the turn takes the oldest wake, the others stay pending and the run's first step takes them as its queue.
  v_window := COALESCE(v_wake.burst_window_ms, 0);
  v_max := COALESCE(v_wake.burst_max_ms, 0);
  IF v_window > 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.agent_wakes w
       WHERE w.agent_id = p_agent AND w.scope_key = p_scope AND w.status = 'pending' AND w.id <> v_wake.id
         AND w.created_at > now() - make_interval(secs => greatest(v_window - 500, 0) / 1000.0)
    ) AND v_wake.created_at > now() - make_interval(secs => greatest(v_max, v_window) / 1000.0) THEN
      RETURN jsonb_build_object('result', 'idle', 'ended', v_ended);
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

REVOKE ALL ON FUNCTION public.agent_turn_begin(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_turn_begin(uuid, text, text, integer) TO app_be;

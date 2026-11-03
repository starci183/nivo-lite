-- agent-run-resume: forward-only; immutable once on origin/main. Expand only: new columns and functions, nothing existing altered.
-- A run that stopped on a failed step is parked, not forgotten: it keeps its done steps, their results and the failed step, and it can run
-- again from that step, by a person, by a new build or by the sweep. "Parked" is the existing 'dead' status with a failed step; the columns
-- below say under which build it parked, who resumed it, why, and how many times the machine tried on its own.

ALTER TABLE public.agent_runs
    ADD COLUMN parked_build text,
    ADD COLUMN resume_attempts smallint NOT NULL DEFAULT 0,
    ADD COLUMN resume_not_before timestamptz,
    ADD COLUMN resumed_at timestamptz,
    ADD COLUMN resumed_by text,
    ADD COLUMN resume_reason text;

-- Records the build a run parked under, so a new build can tell which parked runs it may try again. False when the run is not parked.
CREATE FUNCTION public.agent_run_park_mark(p_run uuid, p_build text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.agent_runs r SET parked_build = p_build WHERE r.id = p_run AND r.status = 'dead';
  RETURN FOUND;
END;
$$;

-- Runs a parked run again from its failed step. The failed step goes back to 'pending' with a new fence and no tries spent (its input is
-- replaced when p_input is given); every done step keeps its result and is never claimed again, so a pivot that was done is never repeated.
-- A machine resume (p_auto) is bounded by p_max tries and spaced by p_backoff_s doubling with each one. Answers {result: 'resumed', stepKey,
-- workspaceId, errorCode, at} or {result: <why not>}: 'not_found', 'compensated' (a compensated run is triggered again, never resumed), 'not_parked',
-- 'no_failed_step', 'exhausted'.
CREATE FUNCTION public.agent_run_resume(
    p_run uuid, p_actor text, p_reason text, p_input jsonb, p_auto boolean, p_max integer, p_backoff_s integer
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_run public.agent_runs%ROWTYPE;
  v_step public.agent_run_steps%ROWTYPE;
BEGIN
  SELECT * INTO v_run FROM public.agent_runs r WHERE r.id = p_run FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'not_found');
  END IF;
  IF v_run.status = 'compensated' OR v_run.status = 'compensating' THEN
    RETURN jsonb_build_object('result', 'compensated');
  END IF;
  IF v_run.status <> 'dead' THEN
    RETURN jsonb_build_object('result', 'not_parked');
  END IF;
  SELECT * INTO v_step FROM public.agent_run_steps s WHERE s.run_id = p_run AND s.status = 'failed' ORDER BY s.seq LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'no_failed_step');
  END IF;
  IF p_auto AND v_run.resume_attempts >= p_max THEN
    RETURN jsonb_build_object('result', 'exhausted');
  END IF;
  UPDATE public.agent_run_steps s SET status = 'pending', attempt = 0, error_code = NULL, claim_until = NULL, wait_item_id = NULL,
         not_before = now(), fence = s.fence + 1, input = COALESCE(p_input, s.input)
   WHERE s.id = v_step.id;
  UPDATE public.agent_runs r SET status = 'running', error_code = NULL, finished_at = NULL, dead_lettered_at = NULL,
         resumed_at = now(), resumed_by = p_actor, resume_reason = p_reason,
         resume_attempts = CASE WHEN p_auto THEN r.resume_attempts + 1 ELSE r.resume_attempts END,
         resume_not_before = CASE WHEN p_auto THEN now() + make_interval(secs => p_backoff_s * (2 ^ r.resume_attempts)::integer) ELSE r.resume_not_before END
   WHERE r.id = p_run;
  RETURN jsonb_build_object('result', 'resumed', 'stepKey', v_step.step_key, 'workspaceId', v_run.workspace_id, 'errorCode', v_step.error_code,
                            'at', (extract(epoch FROM clock_timestamp()) * 1000)::bigint);
END;
$$;

-- The parked runs a machine may try again, oldest first: not compensated, with a failed step whose code is not one that must stay with a
-- person (p_exclude), under the tries cap, past their spacing and parked at least p_min_age_s ago. With p_by_build only those parked under
-- another build than p_build.
CREATE FUNCTION public.agent_run_parked(p_limit integer, p_build text, p_by_build boolean, p_min_age_s integer, p_max integer, p_exclude text[])
    RETURNS TABLE (parked_run uuid, parked_workspace uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT r.id, r.workspace_id
    FROM public.agent_runs r
   WHERE r.status = 'dead'
     AND r.resume_attempts < p_max
     AND (r.resume_not_before IS NULL OR r.resume_not_before < now())
     AND (r.finished_at IS NULL OR r.finished_at < now() - make_interval(secs => p_min_age_s))
     AND (NOT p_by_build OR r.parked_build IS DISTINCT FROM p_build)
     AND EXISTS (SELECT 1 FROM public.agent_run_steps s WHERE s.run_id = r.id AND s.status = 'failed' AND NOT (COALESCE(s.error_code, '') = ANY (p_exclude)))
   ORDER BY r.finished_at NULLS FIRST
   LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.agent_run_park_mark(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_run_resume(uuid, text, text, jsonb, boolean, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_run_parked(integer, text, boolean, integer, integer, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_run_park_mark(uuid, text) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_run_resume(uuid, text, text, jsonb, boolean, integer, integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_run_parked(integer, text, boolean, integer, integer, text[]) TO app_be;

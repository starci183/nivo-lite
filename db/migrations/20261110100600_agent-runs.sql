-- agent-runs: forward-only; immutable once on origin/main. Expand only: new tables and functions, nothing existing altered.
-- The durable run of one wake. A run is one row per wake; its steps are the saga: each step is a row with a status, a fence, an attempt
-- count and the result it stored, so a crash at any boundary resumes from the rows. Every state change of a step commits through a
-- function that checks the fence of the claim, so a write under an old fence changes nothing. The back end calls the functions and writes the
-- tables only to insert a run and to read. Run rows lock before step rows in every function, so two functions never wait on each other.

CREATE TABLE public.agent_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    wake_id uuid NOT NULL REFERENCES public.agent_wakes(id) ON DELETE CASCADE,
    trigger text NOT NULL,
    version_id uuid,
    status text NOT NULL DEFAULT 'running',
    context jsonb NOT NULL DEFAULT '{}'::jsonb,
    step_seq integer NOT NULL DEFAULT 0,
    error_code text,
    dead_lettered_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_runs_wake_key UNIQUE (wake_id),
    CONSTRAINT agent_runs_status_check CHECK (status IN ('running', 'waiting', 'done', 'failed', 'dead', 'compensating', 'compensated')),
    CONSTRAINT agent_runs_trigger_check CHECK (char_length(trigger) BETWEEN 1 AND 100),
    CONSTRAINT agent_runs_context_check CHECK (jsonb_typeof(context) = 'object' AND octet_length(context::text) <= 65536)
);
CREATE INDEX agent_runs_agent_idx ON public.agent_runs USING btree (agent_id, created_at DESC);
CREATE INDEX agent_runs_unspoken_idx ON public.agent_runs USING btree (updated_at)
    WHERE status IN ('dead', 'compensated') AND dead_lettered_at IS NULL;

CREATE TABLE public.agent_run_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    seq integer NOT NULL,
    step_key text NOT NULL,
    node_key text NOT NULL,
    kind text NOT NULL,
    effect jsonb NOT NULL,
    input jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending',
    attempt smallint NOT NULL DEFAULT 0,
    max_attempts smallint NOT NULL DEFAULT 3,
    comp_attempts smallint NOT NULL DEFAULT 0,
    deadline_ms integer NOT NULL,
    fence bigint NOT NULL DEFAULT 0,
    not_before timestamptz NOT NULL DEFAULT now(),
    claim_until timestamptz,
    wait_item_id uuid,
    result jsonb,
    error_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_run_steps_key UNIQUE (run_id, step_key),
    CONSTRAINT agent_run_steps_seq_key UNIQUE (run_id, seq),
    CONSTRAINT agent_run_steps_status_check CHECK (status IN ('pending', 'running', 'done', 'failed', 'compensating', 'compensated')),
    CONSTRAINT agent_run_steps_text_check CHECK (char_length(step_key) BETWEEN 1 AND 200 AND char_length(node_key) BETWEEN 1 AND 200 AND char_length(kind) BETWEEN 1 AND 100),
    CONSTRAINT agent_run_steps_effect_check CHECK (jsonb_typeof(effect) = 'object'),
    CONSTRAINT agent_run_steps_json_check CHECK (
        jsonb_typeof(input) = 'object' AND octet_length(input::text) <= 65536
        AND (result IS NULL OR (jsonb_typeof(result) = 'object' AND octet_length(result::text) <= 65536))
    ),
    CONSTRAINT agent_run_steps_budget_check CHECK (max_attempts BETWEEN 1 AND 10 AND deadline_ms BETWEEN 1000 AND 3600000)
);
CREATE INDEX agent_run_steps_open_idx ON public.agent_run_steps USING btree (run_id, seq) WHERE status IN ('pending', 'running', 'failed', 'compensating');
CREATE INDEX agent_run_steps_claim_idx ON public.agent_run_steps USING btree (claim_until) WHERE status IN ('running', 'compensating');
CREATE INDEX agent_run_steps_pending_idx ON public.agent_run_steps USING btree (not_before) WHERE status = 'pending';
CREATE INDEX agent_run_steps_wait_idx ON public.agent_run_steps USING btree (wait_item_id) WHERE wait_item_id IS NOT NULL;

CREATE TRIGGER agent_runs_set_updated_at BEFORE UPDATE ON public.agent_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agent_run_steps_set_updated_at BEFORE UPDATE ON public.agent_run_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_runs_app_be_select ON public.agent_runs FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_runs_app_be_insert ON public.agent_runs FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_runs_app_be_delete ON public.agent_runs FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.agent_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.agent_runs TO app_be;

ALTER TABLE public.agent_run_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_run_steps_app_be_select ON public.agent_run_steps FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_run_steps_app_be_delete ON public.agent_run_steps FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.agent_run_steps FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.agent_run_steps TO app_be;

-- A step as the back end reads it from a function: the row, plus the results of the steps done before it, by step key.
CREATE FUNCTION public.agent_run_step_json(s public.agent_run_steps) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'stepId', s.id, 'runId', s.run_id, 'workspaceId', s.workspace_id, 'agentId', s.agent_id, 'seq', s.seq,
    'stepKey', s.step_key, 'nodeKey', s.node_key, 'kind', s.kind, 'effect', s.effect, 'input', s.input,
    'status', s.status, 'attempt', s.attempt, 'maxAttempts', s.max_attempts, 'deadlineMs', s.deadline_ms,
    'fence', s.fence, 'result', s.result, 'errorCode', s.error_code, 'waitItemId', s.wait_item_id,
    'earlier', COALESCE((SELECT jsonb_object_agg(e.step_key, e.result) FROM public.agent_run_steps e
                          WHERE e.run_id = s.run_id AND e.status = 'done' AND e.seq < s.seq AND e.result IS NOT NULL), '{}'::jsonb)
  );
$$;

-- Writes steps behind the last one of a run, once: a step key already there is left as it is, so a replay writes nothing twice. Answers how many
-- rows were written; a run that has ended takes none.
CREATE FUNCTION public.agent_run_append(p_run uuid, p_specs jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_run public.agent_runs%ROWTYPE;
  v_count integer;
  v_total integer;
BEGIN
  SELECT * INTO v_run FROM public.agent_runs r WHERE r.id = p_run FOR UPDATE;
  IF NOT FOUND OR v_run.status IN ('done', 'failed', 'dead', 'compensating', 'compensated') THEN
    RETURN 0;
  END IF;
  v_total := jsonb_array_length(p_specs);
  WITH written AS (
    INSERT INTO public.agent_run_steps (run_id, workspace_id, agent_id, seq, step_key, node_key, kind, effect, input, max_attempts, deadline_ms)
      SELECT v_run.id, v_run.workspace_id, v_run.agent_id, v_run.step_seq + x.ord::integer, x.spec ->> 'stepKey', x.spec ->> 'nodeKey',
             x.spec ->> 'kind', x.spec -> 'effect', COALESCE(x.spec -> 'input', '{}'::jsonb),
             (x.spec ->> 'maxAttempts')::smallint, (x.spec ->> 'deadlineMs')::integer
        FROM jsonb_array_elements(p_specs) WITH ORDINALITY AS x(spec, ord)
      ON CONFLICT DO NOTHING
      RETURNING 1
  )
  SELECT count(*) INTO v_count FROM written;
  UPDATE public.agent_runs r SET step_seq = r.step_seq + v_total WHERE r.id = v_run.id;
  RETURN v_count;
END;
$$;

-- Claims one step under a new fence. With a step key it claims that step alone (a tool called from inside the turn); without one it claims the
-- first step still open, and only when nothing else of the run runs. Answers {result}: 'claimed' (with the step), 'done' (the stored answer),
-- 'busy' (a live claim holds it), 'later' (not before the backoff), 'waiting_expired' (a wait past its deadline: the sweeper's), 'exhausted' (the
-- tries are spent: the engine routes the failure), 'closed' (the run or step has ended), 'idle' (nothing open) or 'gone'.
CREATE FUNCTION public.agent_step_claim(p_run uuid, p_step_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_run public.agent_runs%ROWTYPE;
  v_step public.agent_run_steps%ROWTYPE;
BEGIN
  SELECT * INTO v_run FROM public.agent_runs r WHERE r.id = p_run FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'gone');
  END IF;
  IF v_run.status IN ('done', 'failed', 'dead', 'compensating', 'compensated') THEN
    RETURN jsonb_build_object('result', 'closed', 'runStatus', v_run.status);
  END IF;
  IF p_step_key IS NULL THEN
    SELECT * INTO v_step FROM public.agent_run_steps s
     WHERE s.run_id = p_run AND s.status IN ('pending', 'running', 'failed') ORDER BY s.seq LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('result', 'idle');
    END IF;
  ELSE
    SELECT * INTO v_step FROM public.agent_run_steps s WHERE s.run_id = p_run AND s.step_key = p_step_key FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('result', 'gone');
    END IF;
  END IF;
  IF v_step.status = 'done' THEN
    RETURN jsonb_build_object('result', 'done', 'answer', v_step.result, 'step', public.agent_run_step_json(v_step));
  END IF;
  IF v_step.status IN ('failed', 'compensating', 'compensated') THEN
    RETURN jsonb_build_object('result', 'closed', 'runStatus', v_run.status, 'step', public.agent_run_step_json(v_step));
  END IF;
  IF v_step.status = 'running' AND v_step.claim_until > now() THEN
    RETURN jsonb_build_object('result', 'busy');
  END IF;
  IF v_step.status = 'running' AND v_step.wait_item_id IS NOT NULL THEN
    RETURN jsonb_build_object('result', 'waiting_expired', 'step', public.agent_run_step_json(v_step));
  END IF;
  IF v_step.status = 'pending' AND v_step.not_before > now() THEN
    RETURN jsonb_build_object('result', 'later', 'retryAfterMs', ceil(extract(epoch FROM (v_step.not_before - now())) * 1000)::integer);
  END IF;
  IF v_step.attempt >= v_step.max_attempts THEN
    RETURN jsonb_build_object('result', 'exhausted', 'step', public.agent_run_step_json(v_step));
  END IF;
  UPDATE public.agent_run_steps s
     SET status = 'running', attempt = s.attempt + 1, fence = s.fence + 1,
         claim_until = now() + make_interval(secs => s.deadline_ms / 1000.0)
   WHERE s.id = v_step.id RETURNING * INTO v_step;
  UPDATE public.agent_runs r SET status = 'running' WHERE r.id = p_run AND r.status = 'waiting';
  RETURN jsonb_build_object('result', 'claimed', 'step', public.agent_run_step_json(v_step));
END;
$$;

-- Commits what a claimed step did, under its fence: 'fenced' when the claim moved on, changing nothing. p_outcome is 'done' (the result is stored;
-- the run is done when nothing else is open and p_more says no step follows), 'wait' (the step stays claimed until p_deadline, for the work item),
-- 'retry' (pending again after p_retry_s seconds) or 'failed' (stopped; the engine routes it).
CREATE FUNCTION public.agent_step_commit(
    p_run uuid, p_step_key text, p_fence bigint, p_outcome text, p_result jsonb, p_error text, p_retry_s integer, p_wait_item uuid, p_deadline timestamptz,
    p_more boolean
) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_run_id uuid := p_run;
  v_step public.agent_run_steps%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.agent_runs r WHERE r.id = v_run_id FOR UPDATE;
  SELECT * INTO v_step FROM public.agent_run_steps s WHERE s.run_id = p_run AND s.step_key = p_step_key FOR UPDATE;
  IF NOT FOUND OR v_step.fence <> p_fence OR v_step.status <> 'running' THEN
    RETURN 'fenced';
  END IF;
  IF p_outcome = 'done' THEN
    UPDATE public.agent_run_steps s SET status = 'done', result = p_result, error_code = NULL, claim_until = NULL, wait_item_id = NULL WHERE s.id = v_step.id;
    UPDATE public.agent_runs r SET
        status = CASE WHEN NOT p_more AND NOT EXISTS (
            SELECT 1 FROM public.agent_run_steps o WHERE o.run_id = v_run_id AND o.status NOT IN ('done')) THEN 'done' ELSE 'running' END,
        finished_at = CASE WHEN NOT p_more AND NOT EXISTS (
            SELECT 1 FROM public.agent_run_steps o WHERE o.run_id = v_run_id AND o.status NOT IN ('done')) THEN now() ELSE r.finished_at END
     WHERE r.id = v_run_id;
  ELSIF p_outcome = 'wait' THEN
    UPDATE public.agent_run_steps s SET wait_item_id = p_wait_item, claim_until = p_deadline WHERE s.id = v_step.id;
    UPDATE public.agent_runs r SET status = 'waiting' WHERE r.id = v_run_id;
  ELSIF p_outcome = 'retry' THEN
    UPDATE public.agent_run_steps s SET status = 'pending', error_code = p_error, claim_until = NULL, wait_item_id = NULL,
           not_before = now() + make_interval(secs => p_retry_s) WHERE s.id = v_step.id;
    UPDATE public.agent_runs r SET status = 'running' WHERE r.id = v_run_id;
  ELSE
    UPDATE public.agent_run_steps s SET status = 'failed', error_code = p_error, claim_until = NULL, wait_item_id = NULL WHERE s.id = v_step.id;
    UPDATE public.agent_runs r SET status = 'running' WHERE r.id = v_run_id;
  END IF;
  RETURN 'ok';
END;
$$;

-- A person's answer to the work item a step waits on, in the transaction of the decision: finishes the wait step and bumps its fence, so the
-- handler that began the wait can no longer write. Answers {result: 'resumed', runId} or {result: 'none'} when no step waits on the item.
CREATE FUNCTION public.agent_step_resume(p_item uuid, p_result jsonb, p_more boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_run_id uuid;
  v_step public.agent_run_steps%ROWTYPE;
BEGIN
  SELECT s.run_id INTO v_run_id FROM public.agent_run_steps s WHERE s.wait_item_id = p_item AND s.status = 'running' LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'none');
  END IF;
  PERFORM 1 FROM public.agent_runs r WHERE r.id = v_run_id FOR UPDATE;
  SELECT * INTO v_step FROM public.agent_run_steps s WHERE s.run_id = v_run_id AND s.wait_item_id = p_item AND s.status = 'running' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'none');
  END IF;
  UPDATE public.agent_run_steps s SET status = 'done', result = p_result, error_code = NULL, claim_until = NULL, wait_item_id = NULL, fence = s.fence + 1
   WHERE s.id = v_step.id;
  UPDATE public.agent_runs r SET
      status = CASE WHEN NOT p_more AND NOT EXISTS (
          SELECT 1 FROM public.agent_run_steps o WHERE o.run_id = v_run_id AND o.status NOT IN ('done')) THEN 'done' ELSE 'running' END,
      finished_at = CASE WHEN NOT p_more AND NOT EXISTS (
          SELECT 1 FROM public.agent_run_steps o WHERE o.run_id = v_run_id AND o.status NOT IN ('done')) THEN now() ELSE r.finished_at END
   WHERE r.id = v_run_id;
  RETURN jsonb_build_object('result', 'resumed', 'runId', v_run_id, 'stepKey', v_step.step_key);
END;
$$;

-- Moves the run from the status the caller read to the one it decided, once. The done steps named in p_compensate become 'compensating'. Answers
-- false when the run was no longer in p_from: another path decided first.
CREATE FUNCTION public.agent_run_route(p_run uuid, p_from text, p_to text, p_error text, p_compensate text[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.agent_runs r SET status = p_to, error_code = p_error,
         finished_at = CASE WHEN p_to IN ('dead', 'failed') THEN now() ELSE r.finished_at END
   WHERE r.id = p_run AND r.status = p_from;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE public.agent_run_steps s SET status = 'compensating', claim_until = NULL
   WHERE s.run_id = p_run AND s.status = 'done' AND s.step_key = ANY (p_compensate);
  RETURN true;
END;
$$;

-- Claims the last step still to compensate (reverse order of the work). Answers {result: 'claimed', step}, 'busy', or 'finished' once none is left,
-- which ends the run as 'compensated'.
CREATE FUNCTION public.agent_comp_claim(p_run uuid, p_lease_s integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_run public.agent_runs%ROWTYPE;
  v_step public.agent_run_steps%ROWTYPE;
BEGIN
  SELECT * INTO v_run FROM public.agent_runs r WHERE r.id = p_run FOR UPDATE;
  IF NOT FOUND OR v_run.status <> 'compensating' THEN
    RETURN jsonb_build_object('result', 'closed');
  END IF;
  SELECT * INTO v_step FROM public.agent_run_steps s WHERE s.run_id = p_run AND s.status = 'compensating' ORDER BY s.seq DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.agent_runs r SET status = 'compensated', finished_at = now() WHERE r.id = p_run;
    RETURN jsonb_build_object('result', 'finished');
  END IF;
  IF v_step.claim_until IS NOT NULL AND v_step.claim_until > now() THEN
    RETURN jsonb_build_object('result', 'busy');
  END IF;
  UPDATE public.agent_run_steps s SET fence = s.fence + 1, claim_until = now() + make_interval(secs => p_lease_s)
   WHERE s.id = v_step.id RETURNING * INTO v_step;
  RETURN jsonb_build_object('result', 'claimed', 'step', public.agent_run_step_json(v_step));
END;
$$;

-- Commits a compensation under its fence. p_ok marks the step 'compensated'; a failure keeps it 'compensating' for another try after p_retry_s
-- seconds, and past p_max tries the run is 'dead' for a person. Answers 'ok', 'dead' or 'fenced'.
CREATE FUNCTION public.agent_comp_commit(p_run uuid, p_step_key text, p_fence bigint, p_ok boolean, p_error text, p_retry_s integer, p_max integer) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_run_id uuid := p_run;
  v_step public.agent_run_steps%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.agent_runs r WHERE r.id = v_run_id FOR UPDATE;
  SELECT * INTO v_step FROM public.agent_run_steps s WHERE s.run_id = p_run AND s.step_key = p_step_key FOR UPDATE;
  IF NOT FOUND OR v_step.fence <> p_fence OR v_step.status <> 'compensating' THEN
    RETURN 'fenced';
  END IF;
  IF p_ok THEN
    UPDATE public.agent_run_steps s SET status = 'compensated', claim_until = NULL, error_code = NULL WHERE s.id = v_step.id;
    RETURN 'ok';
  END IF;
  UPDATE public.agent_run_steps s SET comp_attempts = s.comp_attempts + 1, error_code = p_error,
         claim_until = now() + make_interval(secs => p_retry_s) WHERE s.id = v_step.id;
  IF v_step.comp_attempts + 1 >= p_max THEN
    UPDATE public.agent_runs r SET status = 'dead', error_code = 'compensation_failed', finished_at = now() WHERE r.id = v_run_id;
    RETURN 'dead';
  END IF;
  RETURN 'ok';
END;
$$;

-- Marks that a person was told about a run that stopped; false when it was already marked, so the handler's deadLetter is called once.
CREATE FUNCTION public.agent_run_spoken(p_run uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.agent_runs r SET dead_lettered_at = now()
   WHERE r.id = p_run AND r.dead_lettered_at IS NULL AND r.status IN ('dead', 'compensated');
  RETURN FOUND;
END;
$$;

-- What the minute sweep must look at, at most p_limit of each kind: steps past their deadline (a crashed claim, or a wait whose time ran out),
-- pending steps that are ready and that no job picked up, compensations to continue, and stopped runs nobody was told about.
CREATE FUNCTION public.agent_run_due(p_limit integer)
    RETURNS TABLE (due_kind text, due_run uuid, due_workspace uuid, due_agent uuid, due_step text, due_fence bigint, due_at timestamptz)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  (SELECT 'expired'::text, s.run_id, s.workspace_id, s.agent_id, s.step_key, s.fence, s.claim_until
     FROM public.agent_run_steps s
     JOIN public.agent_runs r ON r.id = s.run_id
    WHERE s.status = 'running' AND s.claim_until < now() AND r.status IN ('running', 'waiting')
    ORDER BY s.claim_until LIMIT p_limit)
  UNION ALL
  (SELECT 'ready'::text, s.run_id, s.workspace_id, s.agent_id, s.step_key, s.fence, s.not_before
     FROM public.agent_run_steps s
     JOIN public.agent_runs r ON r.id = s.run_id
    WHERE s.status = 'pending' AND s.not_before < now() - interval '1 minute' AND r.status = 'running'
      AND NOT EXISTS (SELECT 1 FROM public.agent_run_steps e WHERE e.run_id = s.run_id AND e.seq < s.seq AND e.status IN ('pending', 'running', 'failed'))
    ORDER BY s.not_before LIMIT p_limit)
  UNION ALL
  (SELECT 'compensating'::text, s.run_id, s.workspace_id, s.agent_id, s.step_key, s.fence, COALESCE(s.claim_until, s.updated_at)
     FROM public.agent_run_steps s
     JOIN public.agent_runs r ON r.id = s.run_id
    WHERE s.status = 'compensating' AND r.status = 'compensating' AND (s.claim_until IS NULL OR s.claim_until < now())
      AND s.updated_at < now() - interval '1 minute'
    ORDER BY s.updated_at LIMIT p_limit)
  UNION ALL
  (SELECT 'unspoken'::text, r.id, r.workspace_id, r.agent_id, ''::text, 0::bigint, r.updated_at
     FROM public.agent_runs r
    WHERE r.status IN ('dead', 'compensated') AND r.dead_lettered_at IS NULL AND r.updated_at < now() - interval '1 minute'
    ORDER BY r.updated_at LIMIT p_limit);
$$;

REVOKE ALL ON FUNCTION public.agent_run_step_json(public.agent_run_steps) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_run_append(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_step_claim(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_step_commit(uuid, text, bigint, text, jsonb, text, integer, uuid, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_step_resume(uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_run_route(uuid, text, text, text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_comp_claim(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_comp_commit(uuid, text, bigint, boolean, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_run_spoken(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_run_due(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_run_step_json(public.agent_run_steps) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_run_append(uuid, jsonb) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_step_claim(uuid, text) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_step_commit(uuid, text, bigint, text, jsonb, text, integer, uuid, timestamptz, boolean) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_step_resume(uuid, jsonb, boolean) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_run_route(uuid, text, text, text, text[]) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_comp_claim(uuid, integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_comp_commit(uuid, text, bigint, boolean, text, integer, integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_run_spoken(uuid) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_run_due(integer) TO app_be;

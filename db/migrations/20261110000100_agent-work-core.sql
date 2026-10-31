-- agent-work-core: forward-only; immutable once on origin/main. Expand only: new tables and functions, nothing existing altered.
-- An agent is data. A wake says why it must act (a customer message, a tag, an internal event, a schedule), a turn is one run of
-- it, goals and tasks are what the agent keeps, triggers are when it wakes by itself. The lock is a lease, one row per scope:
-- a customer conversation locks by itself (scope 'conversation:<id>'), every other wake locks the whole agent (scope 'agent'), so one
-- conversation never has two turns at once while several customers of one agent are answered in parallel. The functions below are
-- the whole of the concurrency story; the back end calls them and never touches the lease rows.

CREATE TABLE public.agent_work_settings (
    workspace_id uuid NOT NULL PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
    work_enabled boolean NOT NULL DEFAULT true,
    road text NOT NULL DEFAULT 'legacy',
    background_daily_cap integer NOT NULL DEFAULT 200,
    paused_by uuid REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    paused_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_work_settings_road_check CHECK (road IN ('legacy', 'core')),
    CONSTRAINT agent_work_settings_cap_check CHECK (background_daily_cap BETWEEN 0 AND 10000)
);

CREATE TABLE public.agent_work_state (
    agent_id uuid NOT NULL PRIMARY KEY REFERENCES public.agents(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    work_enabled boolean NOT NULL DEFAULT true,
    paused_by uuid REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    paused_at timestamptz,
    failures integer NOT NULL DEFAULT 0,
    breaker_until timestamptz,
    last_turn_at timestamptz,
    background_day date,
    background_turns integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_work_state_workspace_idx ON public.agent_work_state USING btree (workspace_id);

CREATE TABLE public.agent_work_leases (
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    scope_key text NOT NULL,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    fence bigint NOT NULL DEFAULT 0,
    lease_owner text,
    lease_until timestamptz,
    running_turn_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_work_leases_pkey PRIMARY KEY (agent_id, scope_key),
    CONSTRAINT agent_work_leases_scope_check CHECK (scope_key = 'agent' OR scope_key LIKE 'conversation:%')
);
CREATE INDEX agent_work_leases_running_idx ON public.agent_work_leases USING btree (lease_until) WHERE running_turn_id IS NOT NULL;

CREATE TABLE public.agent_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    title text NOT NULL,
    detail text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'active',
    source text NOT NULL DEFAULT 'owner',
    created_by_member uuid REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    due_at timestamptz,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_goals_status_check CHECK (status IN ('active', 'paused', 'done', 'dropped')),
    CONSTRAINT agent_goals_source_check CHECK (source IN ('owner', 'module', 'agent')),
    CONSTRAINT agent_goals_text_check CHECK (char_length(title) BETWEEN 1 AND 200 AND char_length(detail) <= 2000)
);
CREATE INDEX agent_goals_agent_idx ON public.agent_goals USING btree (agent_id, status);

CREATE TABLE public.agent_wakes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    source text NOT NULL,
    event_key text NOT NULL,
    scope_key text NOT NULL DEFAULT 'agent',
    priority smallint NOT NULL,
    max_attempts smallint NOT NULL DEFAULT 3,
    context jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_member_id uuid REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'pending',
    reason text,
    attempts smallint NOT NULL DEFAULT 0,
    not_before timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_wakes_fact_key UNIQUE (agent_id, source, event_key),
    CONSTRAINT agent_wakes_source_check CHECK (source IN ('customer', 'tag', 'internal', 'schedule')),
    CONSTRAINT agent_wakes_status_check CHECK (status IN ('pending', 'running', 'done', 'skipped', 'held', 'failed', 'dead')),
    CONSTRAINT agent_wakes_scope_check CHECK (scope_key = 'agent' OR scope_key LIKE 'conversation:%'),
    CONSTRAINT agent_wakes_context_check CHECK (jsonb_typeof(context) = 'object')
);
CREATE INDEX agent_wakes_pending_idx ON public.agent_wakes USING btree (agent_id, scope_key, priority, created_at) WHERE status = 'pending';
CREATE INDEX agent_wakes_due_idx ON public.agent_wakes USING btree (not_before) WHERE status = 'pending';
CREATE INDEX agent_wakes_held_idx ON public.agent_wakes USING btree (agent_id) WHERE status = 'held';

CREATE TABLE public.agent_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    goal_id uuid REFERENCES public.agent_goals(id) ON DELETE SET NULL,
    dedupe_key text NOT NULL,
    title text NOT NULL,
    detail text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'open',
    waiting_on text,
    next_action_at timestamptz,
    work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL,
    origin_wake_id uuid REFERENCES public.agent_wakes(id) ON DELETE SET NULL,
    done_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_tasks_dedupe_key UNIQUE (agent_id, dedupe_key),
    CONSTRAINT agent_tasks_status_check CHECK (status IN ('open', 'waiting', 'done', 'dropped')),
    CONSTRAINT agent_tasks_waiting_check CHECK (waiting_on IS NULL OR waiting_on IN ('approval', 'member', 'event')),
    CONSTRAINT agent_tasks_text_check CHECK (char_length(title) BETWEEN 1 AND 200 AND char_length(detail) <= 2000)
);
CREATE INDEX agent_tasks_agent_idx ON public.agent_tasks USING btree (agent_id, status);
CREATE INDEX agent_tasks_due_idx ON public.agent_tasks USING btree (next_action_at) WHERE status = 'open';

CREATE TABLE public.agent_triggers (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    kind text NOT NULL,
    preset text,
    at_time time,
    time_zone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    event_name text,
    probe_key text,
    enabled boolean NOT NULL DEFAULT true,
    next_run_at timestamptz,
    last_fired_at timestamptz,
    reconciled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_triggers_kind_check CHECK (kind IN ('schedule', 'event')),
    CONSTRAINT agent_triggers_preset_check CHECK (preset IS NULL OR preset IN ('every_15m', 'hourly', 'daily_at', 'weekdays_at')),
    CONSTRAINT agent_triggers_shape_check CHECK (
        (kind = 'schedule' AND preset IS NOT NULL AND event_name IS NULL AND (preset IN ('every_15m', 'hourly') OR at_time IS NOT NULL))
        OR (kind = 'event' AND event_name IS NOT NULL AND preset IS NULL)
    )
);
CREATE INDEX agent_triggers_agent_idx ON public.agent_triggers USING btree (agent_id);
CREATE INDEX agent_triggers_next_idx ON public.agent_triggers USING btree (next_run_at) WHERE enabled;
CREATE INDEX agent_triggers_event_idx ON public.agent_triggers USING btree (event_name) WHERE enabled AND kind = 'event';

CREATE TABLE public.agent_turns (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    wake_id uuid NOT NULL REFERENCES public.agent_wakes(id) ON DELETE CASCADE,
    fence bigint NOT NULL,
    runner text NOT NULL DEFAULT 'openclaw',
    runtime_agent_id text,
    thread_key text,
    status text NOT NULL DEFAULT 'running',
    proposal jsonb,
    outcome jsonb,
    model text,
    prompt_tokens integer,
    completion_tokens integer,
    cost numeric(14, 6),
    duration_ms integer,
    error_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_turns_wake_fence_key UNIQUE (wake_id, fence),
    CONSTRAINT agent_turns_status_check CHECK (status IN ('running', 'proposed', 'settled', 'failed', 'abandoned'))
);
CREATE INDEX agent_turns_agent_idx ON public.agent_turns USING btree (agent_id, created_at DESC);
CREATE INDEX agent_turns_running_idx ON public.agent_turns USING btree (runtime_agent_id, thread_key) WHERE status = 'running';

CREATE TRIGGER agent_work_settings_set_updated_at BEFORE UPDATE ON public.agent_work_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agent_work_state_set_updated_at BEFORE UPDATE ON public.agent_work_state FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agent_work_leases_set_updated_at BEFORE UPDATE ON public.agent_work_leases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agent_goals_set_updated_at BEFORE UPDATE ON public.agent_goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agent_wakes_set_updated_at BEFORE UPDATE ON public.agent_wakes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agent_tasks_set_updated_at BEFORE UPDATE ON public.agent_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agent_triggers_set_updated_at BEFORE UPDATE ON public.agent_triggers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agent_turns_set_updated_at BEFORE UPDATE ON public.agent_turns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agent_work_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_work_settings_app_be_select ON public.agent_work_settings FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_work_settings_app_be_insert ON public.agent_work_settings FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_work_settings_app_be_update ON public.agent_work_settings FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.agent_work_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agent_work_settings TO app_be;

ALTER TABLE public.agent_work_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_work_state_app_be_select ON public.agent_work_state FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_work_state_app_be_insert ON public.agent_work_state FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_work_state_app_be_update ON public.agent_work_state FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.agent_work_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agent_work_state TO app_be;

ALTER TABLE public.agent_work_leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_work_leases_app_be_select ON public.agent_work_leases FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.agent_work_leases FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.agent_work_leases TO app_be;

ALTER TABLE public.agent_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_goals_app_be_select ON public.agent_goals FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_goals_app_be_insert ON public.agent_goals FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_goals_app_be_update ON public.agent_goals FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_goals_app_be_delete ON public.agent_goals FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.agent_goals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_goals TO app_be;

ALTER TABLE public.agent_wakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_wakes_app_be_select ON public.agent_wakes FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_wakes_app_be_insert ON public.agent_wakes FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_wakes_app_be_update ON public.agent_wakes FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_wakes_app_be_delete ON public.agent_wakes FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.agent_wakes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_wakes TO app_be;

ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_tasks_app_be_select ON public.agent_tasks FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_tasks_app_be_insert ON public.agent_tasks FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_tasks_app_be_update ON public.agent_tasks FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_tasks_app_be_delete ON public.agent_tasks FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.agent_tasks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_tasks TO app_be;

ALTER TABLE public.agent_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_triggers_app_be_select ON public.agent_triggers FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_triggers_app_be_insert ON public.agent_triggers FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_triggers_app_be_update ON public.agent_triggers FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_triggers_app_be_delete ON public.agent_triggers FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.agent_triggers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_triggers TO app_be;

ALTER TABLE public.agent_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_turns_app_be_select ON public.agent_turns FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY agent_turns_app_be_insert ON public.agent_turns FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_turns_app_be_update ON public.agent_turns FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY agent_turns_app_be_delete ON public.agent_turns FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.agent_turns FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_turns TO app_be;

-- Whether work is switched off for the agent or for its whole workspace. A workspace without a settings row is on.
CREATE FUNCTION public.agent_work_is_off(p_agent uuid, p_workspace uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((SELECT NOT s.work_enabled FROM public.agent_work_state s WHERE s.agent_id = p_agent), false)
      OR COALESCE((SELECT NOT w.work_enabled FROM public.agent_work_settings w WHERE w.workspace_id = p_workspace), false);
$$;

-- Whether the agent belongs to the workspace: the guard of every write that names both, so a caller's workspace id is never a permission.
CREATE FUNCTION public.agent_work_has_agent(p_workspace uuid, p_agent uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.agents a WHERE a.id = p_agent AND a.workspace_id = p_workspace);
$$;

-- Switches work on or off for one agent of the workspace; false when the agent is not the workspace's.
CREATE FUNCTION public.agent_work_switch(p_workspace uuid, p_agent uuid, p_enabled boolean, p_member uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.agent_work_state (agent_id, workspace_id, work_enabled, paused_by, paused_at)
    SELECT a.id, a.workspace_id, p_enabled, CASE WHEN p_enabled THEN NULL ELSE p_member END, CASE WHEN p_enabled THEN NULL ELSE now() END
      FROM public.agents a WHERE a.id = p_agent AND a.workspace_id = p_workspace
    ON CONFLICT (agent_id) DO UPDATE SET
      work_enabled = EXCLUDED.work_enabled, paused_by = EXCLUDED.paused_by, paused_at = EXCLUDED.paused_at;
  RETURN FOUND;
END;
$$;

-- Starts one turn of an agent in one scope. Answers {result: 'killed' | 'busy' | 'idle'} or, for 'begun', the fence, the turn, the wake and
-- the proposal a previous attempt stored (null when none). The lease row of the scope is the lock: a held lease answers busy, a lapsed
-- one is taken over and its turn abandoned. A wake past its attempt budget is dead before any model call; attempts rise here.
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
BEGIN
  SELECT a.workspace_id INTO v_workspace FROM public.agents a WHERE a.id = p_agent;
  IF v_workspace IS NULL THEN
    RETURN jsonb_build_object('result', 'idle');
  END IF;
  INSERT INTO public.agent_work_state (agent_id, workspace_id) VALUES (p_agent, v_workspace) ON CONFLICT (agent_id) DO NOTHING;
  IF public.agent_work_is_off(p_agent, v_workspace) THEN
    UPDATE public.agent_wakes w SET status = 'held', reason = 'killed'
     WHERE w.agent_id = p_agent AND w.scope_key = p_scope AND w.status = 'pending';
    RETURN jsonb_build_object('result', 'killed');
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
      RETURN jsonb_build_object('result', 'idle');
    END IF;
    EXIT WHEN v_wake.attempts < v_wake.max_attempts;
    UPDATE public.agent_wakes w SET status = 'dead', reason = 'attempts', finished_at = now() WHERE w.id = v_wake.id;
  END LOOP;
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
    'proposal', v_proposal
  );
END;
$$;

-- Extends the lease under the fence; false means another worker holds the scope now and this one must stop.
CREATE FUNCTION public.agent_turn_touch(p_agent uuid, p_scope text, p_fence bigint, p_lease_s integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.agent_work_leases l SET lease_until = now() + make_interval(secs => p_lease_s)
   WHERE l.agent_id = p_agent AND l.scope_key = p_scope AND l.fence = p_fence AND l.running_turn_id IS NOT NULL;
  RETURN FOUND;
END;
$$;

-- Stores the proposal under the fence. Answers 'stored', 'fenced' (the lease moved on) or 'killed' (work was switched off while the turn ran).
CREATE FUNCTION public.agent_turn_propose(p_turn uuid, p_agent uuid, p_scope text, p_fence bigint, p_proposal jsonb) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_lease public.agent_work_leases%ROWTYPE;
BEGIN
  SELECT * INTO v_lease FROM public.agent_work_leases l WHERE l.agent_id = p_agent AND l.scope_key = p_scope FOR UPDATE;
  IF NOT FOUND OR v_lease.fence <> p_fence OR v_lease.running_turn_id IS DISTINCT FROM p_turn THEN
    RETURN 'fenced';
  END IF;
  IF public.agent_work_is_off(p_agent, v_lease.workspace_id) THEN
    RETURN 'killed';
  END IF;
  UPDATE public.agent_turns t SET proposal = p_proposal, status = 'proposed' WHERE t.id = p_turn AND t.status IN ('running', 'proposed');
  IF NOT FOUND THEN
    RETURN 'fenced';
  END IF;
  RETURN 'stored';
END;
$$;

-- Ends the turn under the fence. p_status is the end of the wake: 'done', 'skipped', 'held' or 'failed' (retried after p_retry_wait_s
-- until its budget is spent, then dead). A failure counts toward the breaker: p_breaker_after failures in a row hold the agent's
-- background work for p_breaker_s. A done background turn counts toward the day's cap. Releases the lease and answers {fenced, more}:
-- more says a wake of the same scope is due now, so the caller enqueues the next drain.
CREATE FUNCTION public.agent_turn_finish(
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
  IF p_status = 'failed' THEN
    UPDATE public.agent_work_state s SET
        failures = s.failures + 1,
        breaker_until = CASE WHEN s.failures + 1 >= p_breaker_after THEN now() + make_interval(secs => p_breaker_s) ELSE s.breaker_until END,
        last_turn_at = now()
     WHERE s.agent_id = p_agent;
  ELSIF p_status = 'done' THEN
    UPDATE public.agent_work_state s SET
        failures = 0,
        breaker_until = NULL,
        last_turn_at = now(),
        background_turns = CASE
          WHEN v_wake.source NOT IN ('internal', 'schedule') THEN s.background_turns
          WHEN s.background_day = v_today THEN s.background_turns + 1
          ELSE 1 END,
        background_day = CASE WHEN v_wake.source IN ('internal', 'schedule') THEN v_today ELSE s.background_day END
     WHERE s.agent_id = p_agent;
  ELSE
    UPDATE public.agent_work_state s SET last_turn_at = now() WHERE s.agent_id = p_agent;
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

-- What the minute sweep must look at, at most p_limit of each kind: scopes to drain (a lapsed lease, or a due wake with no job in sight),
-- open tasks that are due, and schedule triggers that are overdue or not reconciled with the scheduler for an hour.
CREATE FUNCTION public.agent_work_due(p_limit integer)
    RETURNS TABLE (due_kind text, due_agent uuid, due_workspace uuid, due_scope text, due_subject uuid, due_at timestamptz)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  (SELECT 'lease'::text, l.agent_id, l.workspace_id, l.scope_key, l.running_turn_id, l.lease_until
     FROM public.agent_work_leases l
    WHERE l.running_turn_id IS NOT NULL AND l.lease_until < now()
    ORDER BY l.lease_until LIMIT p_limit)
  UNION ALL
  (SELECT 'wake'::text, w.agent_id, w.workspace_id, w.scope_key, NULL::uuid, min(w.created_at)
     FROM public.agent_wakes w
    WHERE w.status = 'pending' AND w.not_before <= now() AND (w.created_at < now() - interval '1 minute' OR w.attempts > 0)
      AND NOT EXISTS (
        SELECT 1 FROM public.agent_work_leases l
         WHERE l.agent_id = w.agent_id AND l.scope_key = w.scope_key AND l.running_turn_id IS NOT NULL AND l.lease_until >= now())
    GROUP BY w.agent_id, w.workspace_id, w.scope_key
    ORDER BY min(w.created_at) LIMIT p_limit)
  UNION ALL
  (SELECT 'task'::text, t.agent_id, t.workspace_id, 'agent'::text, t.id, t.next_action_at
     FROM public.agent_tasks t
    WHERE t.status = 'open' AND t.next_action_at <= now()
    ORDER BY t.next_action_at LIMIT p_limit)
  UNION ALL
  (SELECT 'trigger'::text, g.agent_id, g.workspace_id, 'agent'::text, g.id, g.next_run_at
     FROM public.agent_triggers g
    WHERE g.enabled AND g.kind = 'schedule'
      AND (g.next_run_at < now() - interval '2 minutes' OR g.reconciled_at IS NULL OR g.reconciled_at < now() - interval '1 hour')
    ORDER BY g.next_run_at NULLS FIRST LIMIT p_limit);
$$;

REVOKE ALL ON FUNCTION public.agent_work_is_off(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_work_has_agent(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_work_switch(uuid, uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_turn_begin(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_turn_touch(uuid, text, bigint, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_turn_propose(uuid, uuid, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_turn_finish(uuid, text, bigint, uuid, text, text, jsonb, text, jsonb, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_work_due(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_work_is_off(uuid, uuid) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_work_has_agent(uuid, uuid) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_work_switch(uuid, uuid, boolean, uuid) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_turn_begin(uuid, text, text, integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_turn_touch(uuid, text, bigint, integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_turn_propose(uuid, uuid, text, bigint, jsonb) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_turn_finish(uuid, text, bigint, uuid, text, text, jsonb, text, jsonb, integer, integer, integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.agent_work_due(integer) TO app_be;

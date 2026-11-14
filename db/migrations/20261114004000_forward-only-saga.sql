-- forward-only-saga: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED: the restart owner applies it.
-- The engine never compensates (owner ruling R81-1). A step is a `read` or a `write`; a run and a step have no `compensating` or
-- `compensated` status; the compensation-tries counter is gone. Re-runnable: every DROP is IF EXISTS and every UPDATE matches nothing
-- the second time.

-- A run or step the engine left in a status that no longer exists closes as failed (nothing undoes it, and the engine never will).
UPDATE public.agent_runs
   SET status = 'failed', ended_at = COALESCE(ended_at, now())
 WHERE status IN ('compensating', 'compensated');

UPDATE public.agent_run_steps
   SET status = 'failed', ended_at = COALESCE(ended_at, now())
 WHERE status IN ('compensating', 'compensated');

-- The kind a stored step effect names: every effect that changed the world (`pivot`, `compensable` with its handler) is a `write`.
UPDATE public.agent_run_steps
   SET effect = '{"kind":"write"}'::jsonb
 WHERE effect->>'kind' IN ('pivot', 'compensable');

ALTER TABLE public.agent_runs DROP CONSTRAINT IF EXISTS agent_runs_status_check;
ALTER TABLE public.agent_runs ADD CONSTRAINT agent_runs_status_check
    CHECK ((status = ANY (ARRAY['running'::text, 'waiting'::text, 'parked'::text, 'failed'::text, 'done'::text, 'dead'::text, 'cancelled'::text])));

ALTER TABLE public.agent_run_steps DROP CONSTRAINT IF EXISTS agent_run_steps_status_check;
ALTER TABLE public.agent_run_steps ADD CONSTRAINT agent_run_steps_status_check
    CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'done'::text, 'failed'::text])));

ALTER TABLE public.agent_run_steps DROP COLUMN IF EXISTS comp_attempts;

-- The one-run-in-flight index lists the statuses in flight: running, waiting, parked.
DROP INDEX IF EXISTS public.agent_runs_one_in_flight_per_subject;
CREATE UNIQUE INDEX agent_runs_one_in_flight_per_subject ON public.agent_runs USING btree (workspace_id, workflow_id, subject_kind, subject_id)
    WHERE (workflow_id IS NOT NULL AND subject_kind IS NOT NULL
        AND status = ANY (ARRAY['running'::text, 'waiting'::text, 'parked'::text]));

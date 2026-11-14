-- run-subject: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the DECOUPLE lane: RESTART-R applies it.
-- The coordinator's final rule (ROAD-HANDOVER "What changed AFTER they started", item 4; R18): ONE RUN IN FLIGHT per (workspace, graph,
-- subject). The subject is the engine's `SubjectRef { kind, id }`, opaque: named by the registration's own key, else the trigger
-- declaration's default key (the route of a person, a transaction, a render, a timer task), else none. A run with no subject (the clock)
-- is never serialised. The store enforces it: a partial unique index over the runs still in flight, so two drains that race to open a run
-- of the same graph and subject can never both succeed; the loser finds the run in flight and its event waits as a held wake row.
-- In flight = running, waiting (at a `wait` or a founder stop), parked, compensating. A run that ended (done, failed, dead, cancelled,
-- compensated) frees its subject, and the next run takes every event that waited.

ALTER TABLE public.agent_runs ADD COLUMN subject_kind text;
ALTER TABLE public.agent_runs ADD COLUMN subject_id text;
ALTER TABLE public.agent_runs ADD CONSTRAINT agent_runs_subject_check CHECK (
    (subject_kind IS NULL AND subject_id IS NULL)
    OR (subject_kind IS NOT NULL AND subject_id IS NOT NULL AND char_length(subject_kind) BETWEEN 1 AND 64 AND char_length(subject_id) BETWEEN 1 AND 200)
);

CREATE UNIQUE INDEX agent_runs_one_in_flight_per_subject ON public.agent_runs USING btree (workspace_id, workflow_id, subject_kind, subject_id)
    WHERE (workflow_id IS NOT NULL AND subject_kind IS NOT NULL
        AND status = ANY (ARRAY['running'::text, 'waiting'::text, 'parked'::text, 'compensating'::text]));

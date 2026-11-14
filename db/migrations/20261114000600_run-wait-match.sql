-- run-wait-match: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the DECOUPLE lane: RESTART-R applies it.
-- The coordinator's final rule (lane concept engine-core rule 8, triggers rule 13): a run parked at a `wait` takes an event of a trigger
-- it lists that matches it, by the run's subject or by the wait's own match value (a payment by its order code). The event finds its
-- waiter EXACTLY through the values the wait parked with, never through a page of the agent's open runs.
-- `wait_match`: the lookup keys of the wait the run is parked on (written when it parks, cleared when it resumes; null while no wait
-- holds the run): one key per test of each trigger the wait lists (its verb, the event member, the value as a digest; a `contains`
-- test keeps its part as text, read with `strpos`), the subject members of a trigger with no test, and a catch-all key per verb for a
-- test the keys cannot hold. The keys are opaque to SQL except that `strpos` read; their shape is the engine's
-- (agent-threads/wait-match.policy.ts).
-- `wait_since`: when the run parked on that wait: among the runs that take one event, the one that started waiting LAST goes first.

ALTER TABLE public.agent_runs ADD COLUMN wait_match text[];
ALTER TABLE public.agent_runs ADD COLUMN wait_since timestamptz;

CREATE INDEX agent_runs_wait_match ON public.agent_runs USING gin (wait_match) WHERE (wait_match IS NOT NULL);

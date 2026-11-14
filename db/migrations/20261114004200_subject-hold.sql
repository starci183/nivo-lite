-- QUEUE-BUILD rule Q-1 (R71/R73): a run that is not finished keeps its SUBJECT for every workflow; contact-freeze is deleted.
-- Apply WITH the code that no longer maps `contact_freezes` (the be module `lead-freezes` is gone) and reads the two new indexes.

-- 1. Events a freeze still held (wakes `held` with reason `lead_frozen`) move to the one hold of the engine: behind the frozen run when
--    it is still in flight (`waiting:<run>`, released when it parks at a wait or finishes), else pending again (the drain takes them;
--    the minute sweep re-enqueues a pending wake whose job is gone).
UPDATE public.agent_wakes w
   SET reason = 'waiting:' || f.frozen_run_id::text
  FROM public.contact_freezes f
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(f.pending -> 'events', '[]'::jsonb)) AS e(event)
       JOIN public.agent_runs r ON r.id = f.frozen_run_id AND r.status IN ('running', 'waiting', 'parked')
 WHERE w.workspace_id = f.workspace_id
   AND w.id::text = e.event ->> 'wakeId'
   AND w.status = 'held'
   AND w.reason = 'lead_frozen';

UPDATE public.agent_wakes
   SET status = 'pending', reason = NULL, attempts = 0, not_before = now()
 WHERE status = 'held'
   AND reason = 'lead_frozen';

-- 2. The freeze table goes (its policy, trigger and indexes go with it). History only: released freezes are dropped with it.
DROP TABLE IF EXISTS public.contact_freezes;

-- 3. The holder read across workflows: the runs in flight of one subject, whatever the workflow (the one-run index leads with
--    `workflow_id` and cannot serve it).
CREATE INDEX IF NOT EXISTS agent_runs_in_flight_subject
    ON public.agent_runs USING btree (workspace_id, subject_kind, subject_id, started_at)
 WHERE status IN ('running', 'waiting', 'parked') AND subject_kind IS NOT NULL;

-- 4. The open stops about a route (a person's route), read exactly instead of a page of the newest stops.
CREATE INDEX IF NOT EXISTS run_stops_route_state
    ON public.run_stops USING btree (workspace_id, route_id, state, created_at, id)
 WHERE route_id IS NOT NULL;

-- 5. The sweep's backstop reads the wakes held behind runs.
CREATE INDEX IF NOT EXISTS agent_wakes_held_waiting
    ON public.agent_wakes USING btree (workspace_id, reason)
 WHERE status = 'held' AND reason LIKE 'waiting:%';

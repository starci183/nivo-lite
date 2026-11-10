-- langgraph-engine_contract_drop-old-kernel: forward-only; immutable once on origin/main. A contract migration (BE-PERSISTENCE-19): it
-- drops, so it runs only once the release that stopped using these objects is accepted. Runs after 20261112014000_ai-usage-work-reference.sql.
-- PHASE 3 of the LangGraph move (PHASE3-20261111.md 4.3): threads are the only engine; the old step kernel (`agent-runs` advance/due/
-- park/ledger/dead-letter, the `agent_step` job) is deleted from the code. What only that kernel read goes here.
-- ORDER (dev): apply ONLY after wave 3 (package C deleted the kernel, the job and the queue) AND after W removed the same four indexes
-- from the blocks-core declarations (`agent.run`, `agent.run-step`) and regenerated db/entities.manifest.json (wave 4, one W save), AND
-- after `reset-workflows` ran for every dev workspace. Production: release N+2 (N = default-on, N+1 = deletions), PHASE3 4.3.
--
-- Evidence that nothing live reads each object (kept code queries run rows only by wakeId (`wake`), agentId (`agent_started`,
-- `agent_status_ended`), status + engine ordered by resumeNotBefore (`status_resume`, the thread sweep) and steps by runId
-- (`run_ordinal`, `run_step_key`) and kind + workItemId (`kind_work_item`, the run page); aggregates (the dashboard's failed runs)
-- need no index):
--   records_agent_run_status_dead_lettered (20261112000800:76): `deadLetteredAt` is filtered/ordered only by agent-run-due.service.ts
--     (deleted by C); the thread projection only WRITES it; the mapper only reads it from a fetched row.
--   records_agent_run_step_status_claimed (000800:159): `claimedUntil` is filtered/ordered only by agent-run-due.service.ts and
--     agent-run-store.service.ts `openWaits` (both deleted by C).
--   records_agent_run_step_status_not_before (000800:161): step `notBefore` is filtered/ordered only by agent-run-due.service.ts.
--   records_agent_run_step_wait_item (000800:163): `waitItemId` is filtered only by agent-run-records.service.ts `stepsWaitingOn` and
--     agent-run-store.service.ts `openWaits` (callers store waitingOn/resume, deleted by C); the projection and the thread sweep only
--     SELECT the field.
--   job_outbox / job_slots rows of queue `agent_step`: the producer and the processor (be/src/modules/queues/agent-step,
--     be/src/features/jobs/run-agent-step) are deleted by C. No pgmq queue, SQL function, table or CHECK exists only for the kernel.
-- KEPT: records_agent_run_status_resume, _wake, _agent_started, _agent_status_ended, _wake_planning_key; records_agent_run_step_run_ordinal,
-- _run_step_key, _kind_work_item; records_agent_run_engine_chk (both values stay: history rows read `legacy`); the views; every JSON field
-- and status value of the old engine (the projection writes several of them and the mapper reads them).
--
-- Re-runnable inside the runner's one transaction per file: every DROP is IF EXISTS, every DELETE is idempotent; the guard below rolls
-- the whole file back while a run of the old engine still exists (the restart owner resets every workflow first).

DO $$
DECLARE
    v_legacy bigint;
    v_open bigint;
BEGIN
    SELECT count(*),
           count(*) FILTER (WHERE data->>'status' IN ('running', 'waiting', 'parked', 'compensating'))
      INTO v_legacy, v_open
      FROM public."records_agent_run"
     WHERE data->>'engine' = 'legacy';
    IF v_legacy > 0 THEN
        RAISE EXCEPTION 'records_agent_run still holds % run(s) of the legacy engine (% open): run reset-workflows for every workspace (or cancel them) before this migration', v_legacy, v_open;
    END IF;
END
$$;

-- drop_index public.records_agent_run:index:records_agent_run_status_dead_lettered: the declaration does not name it
DROP INDEX IF EXISTS public."records_agent_run_status_dead_lettered";
-- drop_index public.records_agent_run_step:index:records_agent_run_step_status_claimed: the declaration does not name it
DROP INDEX IF EXISTS public."records_agent_run_step_status_claimed";
-- drop_index public.records_agent_run_step:index:records_agent_run_step_status_not_before: the declaration does not name it
DROP INDEX IF EXISTS public."records_agent_run_step_status_not_before";
-- drop_index public.records_agent_run_step:index:records_agent_run_step_wait_item: the declaration does not name it
DROP INDEX IF EXISTS public."records_agent_run_step_wait_item";

-- The advance jobs of the deleted kernel (any state: nothing consumes or reads them any more) and their slot leases.
DELETE FROM public.job_slots WHERE queue = 'agent_step';
DELETE FROM public.job_outbox WHERE queue = 'agent_step';

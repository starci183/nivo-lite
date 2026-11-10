-- agent-run-cancel-credit: forward-only; immutable once on origin/main.
-- A run can be cancelled (status `cancelled`, with who and when), and the model calls a run causes are booked to it so each run shows the credit it used.

-- the status of a run may now be `cancelled`
ALTER TABLE public."records_agent_run" DROP CONSTRAINT "records_agent_run_status_chk";
ALTER TABLE public."records_agent_run" ADD CONSTRAINT "records_agent_run_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('running', 'waiting', 'parked', 'failed', 'done', 'dead', 'compensating', 'compensated', 'cancelled'))) NOT VALID;
ALTER TABLE public."records_agent_run" VALIDATE CONSTRAINT "records_agent_run_status_chk";

-- when and by whom a run was cancelled
ALTER TABLE public."records_agent_run" ADD CONSTRAINT "records_agent_run_cancelled_at_chk" CHECK ((data->>'cancelledAt') IS NULL OR ((data->>'cancelledAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_agent_run" VALIDATE CONSTRAINT "records_agent_run_cancelled_at_chk";
ALTER TABLE public."records_agent_run" ADD CONSTRAINT "records_agent_run_cancelled_by_chk" CHECK ((data->>'cancelledBy') IS NULL OR (jsonb_typeof(data->'cancelledBy') = 'string' AND char_length((data->>'cancelledBy')) <= 200)) NOT VALID;
ALTER TABLE public."records_agent_run" VALIDATE CONSTRAINT "records_agent_run_cancelled_by_chk";

-- the typed view gains the two columns at its end
CREATE OR REPLACE VIEW public."v_records_agent_run" WITH (security_invoker = true) AS SELECT id, workspace_id, version, created_at, updated_at, ((data->>'agentId')::uuid) AS "agent_id", ((data->>'wakeId')::uuid) AS "wake_id", (data->>'trigger') AS "trigger", ((data->>'graphVersionId')::uuid) AS "graph_version_id", ((data->>'planning')::boolean) AS "planning", (data->>'status') AS "status", (data->'context') AS "context", (data->'error') AS "error", ((data->>'deadLetteredAt')::timestamptz) AS "dead_lettered_at", (data->>'parkedBuild') AS "parked_build", (data->>'parkReason') AS "park_reason", ((data->>'resumeAttempts')::integer) AS "resume_attempts", ((data->>'resumeNotBefore')::timestamptz) AS "resume_not_before", ((data->>'resumedAt')::timestamptz) AS "resumed_at", (data->>'resumedBy') AS "resumed_by", (data->>'resumeReason') AS "resume_reason", ((data->>'waitWorkItemId')::uuid) AS "wait_work_item_id", ((data->>'waitDeadlineAt')::timestamptz) AS "wait_deadline_at", ((data->>'stepSeq')::integer) AS "step_seq", ((data->>'startedAt')::timestamptz) AS "started_at", ((data->>'endedAt')::timestamptz) AS "ended_at", ((data->>'cancelledAt')::timestamptz) AS "cancelled_at", (data->>'cancelledBy') AS "cancelled_by" FROM public.records WHERE entity = 'agent.run';

-- the run a model call was made for, so a run shows the credit it consumed
ALTER TABLE public.ai_usage_events ADD COLUMN run_id uuid;
-- the calls of a run
CREATE INDEX ai_usage_events_run_idx ON public.ai_usage_events USING btree (run_id) WHERE run_id IS NOT NULL;

-- langgraph-engine: forward-only; immutable once on origin/main. R3 of the LangGraph move (LANGGRAPH-20261110.md, 8.7).
-- Reviewed like a hand-written migration. No transaction control. A `_contract_` file only because the typed view of agent.run is
-- dropped and created again with its new `engine` column; no data is dropped.
--
-- 1. agent.run gains `engine` (`legacy` | `langgraph`): the engine a run began on and ends on. Every run written before is `legacy`.
-- 2. agent.node-effect gains `runId`, `stepKey`, `args`, `facts` (all nullable): the ledger keeps what each call ran with and answered,
--    read by run and step (DESIGN D.1, phase 1 of the move).
-- 3. agent.run-stop: one record per stopped step of a run (never per customer): the one mechanism for every stop (section 8.2).
-- 4. agent_checkpoints, agent_checkpoint_blobs and agent_checkpoint_writes: the LangGraph checkpoint saver's own tables, each row tenant-scoped by
--    workspace_id (the stock saver's tables have none), written through TypeORM by the langgraph integration only.

-- Every run written before this file is a run of the legacy engine: the check below requires the member.
UPDATE public."records_agent_run" SET data = data || '{"engine": "legacy"}'::jsonb WHERE data->>'engine' IS NULL;

-- add_check public.records_agent_run:constraint:records_agent_run_engine_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run" ADD CONSTRAINT "records_agent_run_engine_chk" CHECK ((data->>'engine') IS NOT NULL AND ((data->>'engine') IN ('legacy', 'langgraph'))) NOT VALID;
ALTER TABLE public."records_agent_run" VALIDATE CONSTRAINT "records_agent_run_engine_chk";
-- alter_view public.v_records_agent_run: the view exists with other columns
DROP VIEW public."v_records_agent_run";
CREATE VIEW public."v_records_agent_run" WITH (security_invoker = true) AS SELECT id, workspace_id, version, created_at, updated_at, ((data->>'agentId')::uuid) AS "agent_id", ((data->>'wakeId')::uuid) AS "wake_id", (data->>'trigger') AS "trigger", ((data->>'graphVersionId')::uuid) AS "graph_version_id", ((data->>'planning')::boolean) AS "planning", (data->>'status') AS "status", (data->'context') AS "context", (data->'error') AS "error", ((data->>'deadLetteredAt')::timestamptz) AS "dead_lettered_at", (data->>'parkedBuild') AS "parked_build", (data->>'parkReason') AS "park_reason", ((data->>'resumeAttempts')::integer) AS "resume_attempts", ((data->>'resumeNotBefore')::timestamptz) AS "resume_not_before", ((data->>'resumedAt')::timestamptz) AS "resumed_at", (data->>'resumedBy') AS "resumed_by", (data->>'resumeReason') AS "resume_reason", ((data->>'waitWorkItemId')::uuid) AS "wait_work_item_id", ((data->>'waitDeadlineAt')::timestamptz) AS "wait_deadline_at", ((data->>'stepSeq')::integer) AS "step_seq", ((data->>'startedAt')::timestamptz) AS "started_at", ((data->>'endedAt')::timestamptz) AS "ended_at", ((data->>'cancelledAt')::timestamptz) AS "cancelled_at", (data->>'cancelledBy') AS "cancelled_by", (data->>'engine') AS "engine" FROM public.records WHERE entity = 'agent.run';
GRANT SELECT ON TABLE public."v_records_agent_run" TO app_engine;
-- add_check public.records_agent_node_effect:constraint:records_agent_node_effect_run_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_node_effect" ADD CONSTRAINT "records_agent_node_effect_run_id_chk" CHECK ((data->>'runId') IS NULL OR ((data->>'runId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_agent_node_effect" VALIDATE CONSTRAINT "records_agent_node_effect_run_id_chk";
-- add_check public.records_agent_node_effect:constraint:records_agent_node_effect_step_key_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_node_effect" ADD CONSTRAINT "records_agent_node_effect_step_key_chk" CHECK ((data->>'stepKey') IS NULL OR (jsonb_typeof(data->'stepKey') = 'string' AND char_length((data->>'stepKey')) <= 200)) NOT VALID;
ALTER TABLE public."records_agent_node_effect" VALIDATE CONSTRAINT "records_agent_node_effect_step_key_chk";
-- add_check public.records_agent_node_effect:constraint:records_agent_node_effect_args_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_node_effect" ADD CONSTRAINT "records_agent_node_effect_args_chk" CHECK ((data->>'args') IS NULL OR (jsonb_typeof(data->'args') = 'object')) NOT VALID;
ALTER TABLE public."records_agent_node_effect" VALIDATE CONSTRAINT "records_agent_node_effect_args_chk";
-- add_check public.records_agent_node_effect:constraint:records_agent_node_effect_facts_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_node_effect" ADD CONSTRAINT "records_agent_node_effect_facts_chk" CHECK ((data->>'facts') IS NULL OR (jsonb_typeof(data->'facts') = 'object')) NOT VALID;
ALTER TABLE public."records_agent_node_effect" VALIDATE CONSTRAINT "records_agent_node_effect_facts_chk";
-- create_index public.records_agent_node_effect:index:records_agent_node_effect_run_step: on workspace_id, data->>'runid', data->>'stepkey', id using btree
CREATE INDEX "records_agent_node_effect_run_step" ON public."records_agent_node_effect" USING btree (workspace_id, ((data->>'runId')::uuid), (data->>'stepKey'), id);
-- create_partition public.records_agent_run_stop: records for values in ('agent.run-stop')
CREATE TABLE public."records_agent_run_stop" PARTITION OF public.records FOR VALUES IN ('agent.run-stop');
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_run_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_run_id_chk" CHECK ((data->>'runId') IS NOT NULL AND ((data->>'runId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_run_id_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_step_key_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_step_key_chk" CHECK ((data->>'stepKey') IS NOT NULL AND (jsonb_typeof(data->'stepKey') = 'string' AND char_length((data->>'stepKey')) <= 200)) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_step_key_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_agent_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_agent_id_chk" CHECK ((data->>'agentId') IS NOT NULL AND ((data->>'agentId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_agent_id_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_workflow_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_workflow_id_chk" CHECK ((data->>'workflowId') IS NULL OR ((data->>'workflowId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_workflow_id_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_lead_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_lead_id_chk" CHECK ((data->>'leadId') IS NULL OR ((data->>'leadId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_lead_id_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_conversation_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_conversation_id_chk" CHECK ((data->>'conversationId') IS NULL OR ((data->>'conversationId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_conversation_id_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_kind_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_kind_chk" CHECK ((data->>'kind') IS NOT NULL AND ((data->>'kind') IN ('ai_report', 'ai_error', 'approval'))) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_kind_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_state_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_state_chk" CHECK ((data->>'state') IS NOT NULL AND ((data->>'state') IN ('open', 'resolved'))) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_state_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_reason_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_reason_chk" CHECK ((data->>'reason') IS NOT NULL AND (jsonb_typeof(data->'reason') = 'string' AND char_length((data->>'reason')) <= 20000)) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_reason_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_question_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_question_chk" CHECK ((data->>'question') IS NULL OR (jsonb_typeof(data->'question') = 'string' AND char_length((data->>'question')) <= 20000)) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_question_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_detail_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_detail_chk" CHECK ((data->>'detail') IS NOT NULL AND (jsonb_typeof(data->'detail') = 'object')) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_detail_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_card_message_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_card_message_id_chk" CHECK ((data->>'cardMessageId') IS NULL OR ((data->>'cardMessageId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_card_message_id_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_customer_lines_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_customer_lines_chk" CHECK ((data->>'customerLines') IS NOT NULL AND (jsonb_typeof(data->'customerLines') = 'object')) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_customer_lines_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_answers_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_answers_chk" CHECK ((data->>'answers') IS NOT NULL AND (jsonb_typeof(data->'answers') = 'object')) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_answers_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_decision_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_decision_chk" CHECK ((data->>'decision') IS NULL OR (jsonb_typeof(data->'decision') = 'object')) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_decision_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_repeats_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_repeats_chk" CHECK ((data->>'repeats') IS NOT NULL AND (jsonb_typeof(data->'repeats') = 'number' AND (data->>'repeats') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_repeats_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_stopped_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_stopped_at_chk" CHECK ((data->>'stoppedAt') IS NOT NULL AND ((data->>'stoppedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_stopped_at_chk";
-- add_check public.records_agent_run_stop:constraint:records_agent_run_stop_resolved_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_agent_run_stop" ADD CONSTRAINT "records_agent_run_stop_resolved_at_chk" CHECK ((data->>'resolvedAt') IS NULL OR ((data->>'resolvedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_agent_run_stop" VALIDATE CONSTRAINT "records_agent_run_stop_resolved_at_chk";
-- create_index public.records_agent_run_stop:index:records_agent_run_stop_run: on workspace_id, data->>'runid', id using btree
CREATE INDEX "records_agent_run_stop_run" ON public."records_agent_run_stop" USING btree (workspace_id, ((data->>'runId')::uuid), id);
-- create_index public.records_agent_run_stop:index:records_agent_run_stop_lead_state: on workspace_id, data->>'leadid', data->>'state', id using btree
CREATE INDEX "records_agent_run_stop_lead_state" ON public."records_agent_run_stop" USING btree (workspace_id, ((data->>'leadId')::uuid), (data->>'state'), id);
-- create_index public.records_agent_run_stop:index:records_agent_run_stop_state_stopped: on workspace_id, data->>'state', data->>'stoppedat'desc, iddesc using btree
CREATE INDEX "records_agent_run_stop_state_stopped" ON public."records_agent_run_stop" USING btree (workspace_id, (data->>'state'), (data->>'stoppedAt') DESC, id DESC);
-- add_unique public.records_agent_run_stop:index:records_agent_run_stop_run_step_key: on workspace_id, data->>'runid', data->>'stepkey' using btree
CREATE UNIQUE INDEX "records_agent_run_stop_run_step_key" ON public."records_agent_run_stop" USING btree (workspace_id, ((data->>'runId')::uuid), (data->>'stepKey'));
-- create_view public.v_records_agent_run_stop: typed view with 23 columns
CREATE VIEW public."v_records_agent_run_stop" WITH (security_invoker = true) AS SELECT id, workspace_id, version, created_at, updated_at, ((data->>'runId')::uuid) AS "run_id", (data->>'stepKey') AS "step_key", ((data->>'agentId')::uuid) AS "agent_id", ((data->>'workflowId')::uuid) AS "workflow_id", ((data->>'leadId')::uuid) AS "lead_id", ((data->>'conversationId')::uuid) AS "conversation_id", (data->>'kind') AS "kind", (data->>'state') AS "state", (data->>'reason') AS "reason", (data->>'question') AS "question", (data->'detail') AS "detail", ((data->>'cardMessageId')::uuid) AS "card_message_id", (data->'customerLines') AS "customer_lines", (data->'answers') AS "answers", (data->'decision') AS "decision", ((data->>'repeats')::integer) AS "repeats", ((data->>'stoppedAt')::timestamptz) AS "stopped_at", ((data->>'resolvedAt')::timestamptz) AS "resolved_at" FROM public.records WHERE entity = 'agent.run-stop';
GRANT SELECT ON TABLE public."v_records_agent_run_stop" TO app_engine;

-- The checkpoints of a LangGraph thread (thread_id = the run id). One row per checkpoint; the checkpoint itself is stored as the
-- saver's typed serialisation (`checkpoint_type` + `checkpoint` bytes), the metadata as JSON for `list` filters. `fence` is the lease
-- fence of the driver that wrote it: the saver refuses a write older than the lease row holds.
CREATE TABLE public.agent_checkpoints (
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    checkpoint_id text NOT NULL,
    parent_checkpoint_id text,
    checkpoint_type text NOT NULL,
    checkpoint bytea NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    fence bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_checkpoints_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id),
    CONSTRAINT agent_checkpoints_thread_id_check CHECK ((char_length(thread_id) >= 1 AND char_length(thread_id) <= 200)),
    CONSTRAINT agent_checkpoints_checkpoint_id_check CHECK ((char_length(checkpoint_id) >= 1 AND char_length(checkpoint_id) <= 200))
);

CREATE INDEX agent_checkpoints_workspace_thread ON public.agent_checkpoints USING btree (workspace_id, thread_id, checkpoint_ns, checkpoint_id DESC);
CREATE INDEX agent_checkpoints_created ON public.agent_checkpoints USING btree (created_at);

ALTER TABLE public.agent_checkpoints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_checkpoints FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_checkpoints TO app_be;
CREATE POLICY agent_checkpoints_app_be_all ON public.agent_checkpoints TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

-- The channel values of the checkpoints, stored once per (channel, version), as the stock saver does: a checkpoint row then holds only
-- versions and ids, an unchanged channel (the trigger) is not copied into every checkpoint, and a channel written by an ancestor is
-- read from here (package 0-2, the saver validation kit).
CREATE TABLE public.agent_checkpoint_blobs (
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    channel text NOT NULL,
    version text NOT NULL,
    value_type text NOT NULL,
    value bytea NOT NULL,
    fence bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_checkpoint_blobs_pkey PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
);

CREATE INDEX agent_checkpoint_blobs_workspace_thread ON public.agent_checkpoint_blobs USING btree (workspace_id, thread_id);

ALTER TABLE public.agent_checkpoint_blobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_checkpoint_blobs FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.agent_checkpoint_blobs TO app_be;
CREATE POLICY agent_checkpoint_blobs_app_be_all ON public.agent_checkpoint_blobs TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

-- The pending writes of a checkpoint: what each task of a super-step wrote (a finished task's result is replayed from here instead of
-- running again). One row per (checkpoint, task, index).
CREATE TABLE public.agent_checkpoint_writes (
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    checkpoint_id text NOT NULL,
    task_id text NOT NULL,
    idx integer NOT NULL,
    channel text NOT NULL,
    value_type text NOT NULL,
    value bytea NOT NULL,
    task_path text DEFAULT ''::text NOT NULL,
    fence bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_checkpoint_writes_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

CREATE INDEX agent_checkpoint_writes_workspace_thread ON public.agent_checkpoint_writes USING btree (workspace_id, thread_id, checkpoint_ns, checkpoint_id);

ALTER TABLE public.agent_checkpoint_writes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_checkpoint_writes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_checkpoint_writes TO app_be;
CREATE POLICY agent_checkpoint_writes_app_be_all ON public.agent_checkpoint_writes TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

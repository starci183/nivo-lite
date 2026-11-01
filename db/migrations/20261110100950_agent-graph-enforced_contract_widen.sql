-- agent-graphs: a graph is enforced from its seed and only the owner sets one back to shadow, so the default moves to `enforced`, every
-- agent moves with it (none was enforced on purpose before this, so no owner choice is overwritten), and the graph keeps who set the
-- mode and when. Each walk of a graph now writes one run, on every road an agent acts by: a work item, a reply, a write tool or a
-- hand-over. A run of the last three leaves no work item, so `work_item_id` opens and `dedupe_key` holds the once. A run keeps the
-- road, the mode it ran in, the gate's answer, the facts it could not read and why it could not be judged. `divert` is the outcome of a
-- branch that leads to another action and `stopped` how work ends on a stop. Widening only: no column is dropped and no check tightens.

ALTER TABLE public.agent_graphs ALTER COLUMN mode SET DEFAULT 'enforced';
UPDATE public.agent_graphs SET mode = 'enforced' WHERE mode = 'shadow';
ALTER TABLE public.agent_graphs
    ADD COLUMN mode_set_by uuid,
    ADD COLUMN mode_set_at timestamptz;

ALTER TABLE public.agent_graph_decisions ALTER COLUMN work_item_id DROP NOT NULL;
ALTER TABLE public.agent_graph_decisions
    ADD COLUMN dedupe_key text,
    ADD COLUMN road text NOT NULL DEFAULT 'work',
    ADD COLUMN mode text NOT NULL DEFAULT 'shadow',
    ADD COLUMN gate_verdict text,
    ADD COLUMN unread jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN unjudged text,
    ADD COLUMN subject_type text,
    ADD COLUMN subject_id text;

ALTER TABLE public.agent_graph_decisions
    ADD CONSTRAINT agent_graph_decisions_road_check CHECK (road IN ('work', 'reply', 'tool', 'handover')),
    ADD CONSTRAINT agent_graph_decisions_mode_check CHECK (mode IN ('shadow', 'enforced')),
    ADD CONSTRAINT agent_graph_decisions_gate_check CHECK (gate_verdict IS NULL OR gate_verdict IN ('auto', 'ask')),
    ADD CONSTRAINT agent_graph_decisions_once_check CHECK (work_item_id IS NOT NULL OR dedupe_key IS NOT NULL);

ALTER TABLE public.agent_graph_decisions DROP CONSTRAINT agent_graph_decisions_outcome_check;
ALTER TABLE public.agent_graph_decisions
    ADD CONSTRAINT agent_graph_decisions_outcome_check CHECK (outcome IN ('auto', 'ask', 'stop', 'divert'));

ALTER TABLE public.agent_graph_decisions DROP CONSTRAINT agent_graph_decisions_closed_check;
ALTER TABLE public.agent_graph_decisions
    ADD CONSTRAINT agent_graph_decisions_closed_check
    CHECK (closed_as IS NULL OR closed_as IN ('done', 'approved', 'edited', 'rejected', 'expired', 'stopped'));

CREATE UNIQUE INDEX agent_graph_decisions_dedupe_key ON public.agent_graph_decisions USING btree (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX agent_graph_decisions_runs_idx ON public.agent_graph_decisions USING btree (workspace_id, agent_id, created_at DESC);

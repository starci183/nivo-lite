-- agent-graphs: a proposal can be a `gap` (work no intent of the published graph fits, raised for the owner to decline or turn into a
-- contract) or a `contract` (the task and business limits of an intent that NIVO inferred from the Second Brain at setup, for the owner to
-- approve into a new version). Widening only: the old kinds stay allowed and no row changes.

ALTER TABLE public.agent_graph_proposals DROP CONSTRAINT agent_graph_proposals_kind_check;
ALTER TABLE public.agent_graph_proposals
    ADD CONSTRAINT agent_graph_proposals_kind_check CHECK (kind IN ('conflict', 'learned', 'template_update', 'gap', 'contract'));

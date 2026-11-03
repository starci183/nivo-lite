-- agent-graph-spec-versions: a version a graph spec published (the node graph the seed or a member put on an agent) is its own change
-- kind, `spec`, so the rules-derived refresh of a `seed` version never takes it for its own and replaces it without its flow.
-- Expand only: the kind check admits one more value; every existing row stays valid.
ALTER TABLE public.agent_graph_versions DROP CONSTRAINT agent_graph_versions_kind_check;
ALTER TABLE public.agent_graph_versions ADD CONSTRAINT agent_graph_versions_kind_check
    CHECK (change_kind IN ('seed', 'chat', 'edit', 'conflict', 'learned', 'template', 'rollback', 'spec'));

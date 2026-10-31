-- agent-graph-approvals: a branch ask names its own approver, so the request keeps the group it asked: eligibleFor prefers it to the
-- rule's live group. Expand only: one nullable column and the queue the agent-graphs consumer of approval_resolved reads.

ALTER TABLE public.approval_requests ADD COLUMN approver_group jsonb;
ALTER TABLE public.approval_requests
    ADD CONSTRAINT approval_requests_approver_group_check CHECK (approver_group IS NULL OR jsonb_typeof(approver_group) = 'object');

select pgmq.create('approval_resolved__agent_graphs');
select pgmq.create('approval_resolved__agent_graphs__dead');
select pgmq.bind_topic('approval_resolved', 'approval_resolved__agent_graphs');

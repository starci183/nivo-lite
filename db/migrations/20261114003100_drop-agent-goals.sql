-- drop-agent-goals: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the ENGINE-CLEAN-1 worker: the restart owner
-- applies it. Owner ruling R67 (2026-11-14): agent goals are DELETED (the wake engine's autonomy is gone: one engine on threads). The
-- goals service, the `saveAgentGoal` mutation, the `AgentWork.goals` field, the Work tab's goals card and the tasks-due probe that read
-- them left the source. `agent_tasks.goal_id` (the goal a task served) goes first: it is the one foreign key into the table.

ALTER TABLE public.agent_tasks DROP COLUMN IF EXISTS goal_id;
DROP TABLE IF EXISTS public.agent_goals;

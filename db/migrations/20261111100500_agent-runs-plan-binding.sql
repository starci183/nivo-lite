-- A planned turn binds its plan to the run of its wake (AgentRunStoreService.open with planning: the intent pipeline of an agent whose
-- published version holds contracts): it locks the run row (SELECT ... FOR UPDATE) and writes its version and context. The run table
-- granted app_be SELECT, INSERT and DELETE only, so every such customer turn failed with "permission denied for table agent_runs" and
-- the customer got the holding line. app_be may update those two columns only, of a row that belongs to a workspace.
GRANT UPDATE (version_id, context) ON TABLE public.agent_runs TO app_be;
CREATE POLICY agent_runs_app_be_update ON public.agent_runs FOR UPDATE TO app_be
    USING (workspace_id IS NOT NULL)
    WITH CHECK (workspace_id IS NOT NULL);

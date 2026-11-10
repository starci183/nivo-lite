-- chat-message-and-run-workflow-indexes: forward-only; immutable once on origin/main.
-- Two list queries had no declared index to serve them and were refused with QUERY_NOT_INDEXED:
-- chat.message by conversation and role, newest first (the last reply of the agent, the customer's lines, the last time the customer wrote), and agent.run-workflow by a list of run ids ordered by id.

-- create_index public.records_chat_message:index:records_chat_message_conversation_role_sent: on workspace_id, data->>'conversationid', data->>'role', data->>'sentat'desc, iddesc using btree
CREATE INDEX "records_chat_message_conversation_role_sent" ON public."records_chat_message" USING btree (workspace_id, ((data->>'conversationId')::uuid), (data->>'role'), (data->>'sentAt') DESC, id DESC);
-- create_index public.records_agent_run_workflow:index:records_agent_run_workflow_key: on workspace_id, id using btree
CREATE INDEX "records_agent_run_workflow_key" ON public."records_agent_run_workflow" USING btree (workspace_id, id);

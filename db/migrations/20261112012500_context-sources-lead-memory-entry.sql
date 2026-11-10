-- entity-engine partitions: hand-written in the form `cli entities plan --write` prints (W3, context sources); forward-only.
-- Reviewed like a hand-written migration. No transaction control.
-- Why: care reads a customer's facts entry of lead memory (`agent.lead-memory`, by `entryKey`) through the node data port, which reads
-- newest first; the new declared index `entry_recent` serves that order. Expand only: nothing is dropped here.

-- create_index public.records_agent_lead_memory:index:records_agent_lead_memory_entry_recent: on workspace_id, data->>'entrykey', created_atdesc, iddesc using btree
CREATE INDEX "records_agent_lead_memory_entry_recent" ON public."records_agent_lead_memory" USING btree (workspace_id, (data->>'entryKey'), created_at DESC, id DESC);

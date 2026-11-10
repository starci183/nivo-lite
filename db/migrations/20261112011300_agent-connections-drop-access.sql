-- agent-connections-drop-access: forward-only; immutable once on origin/main. Runs after 20261112011200_rights-one-model.sql.
-- public.agent_connections is routing only from now on: (agent, connection, purpose) says which agent a connection reaches. What an
-- agent may do on a connected account is held in one place, public.mcp_connector_access (its attachment and ticked abilities); the
-- older per-binding level `access` (read, ask, auto) is no longer read or written by any code.
--
-- 1. A chat binding on `read` was "bound but not routed": inbound did not reach the agent, it owned no channel and sent no shift
--    notice. With the level gone every binding routes, so these rows are deleted to keep that behaviour (a `read` binding of a
--    shared purpose, a data source, a tool or a bank feed, is kept: routing never filtered those). `ask` was carried over to the
--    agent's attachment by 20261112011200.
-- 2. The column and its CHECK go.

DELETE FROM public.agent_connections WHERE access = 'read' AND purpose IN ('inbound_chat', 'outbound_chat', 'lead_source');

ALTER TABLE public.agent_connections DROP CONSTRAINT agent_connections_access_check;
ALTER TABLE public.agent_connections DROP COLUMN access;

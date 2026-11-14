-- attachments-no-ability-ticks: forward-only; immutable once on origin/main. Owner ruling 2026-11-13 (nivo-frame `rights`): a hard right is
-- the agent's ATTACHMENT to a connected account (detach = the kill switch) and each node's ONE declared mode (`auto | ask`); nothing else.
-- An attachment row (public.mcp_connector_access) is agent + connection + provider: its ability ticks go (`abilities`, with its check).
-- public.agent_connections.access (read | ask | auto) was a per-binding mode no code reads: it goes too (its check goes with the column).
-- CONTRACT: no be code reads or writes either column any more (AccountAttachmentEntity has no `abilities`; AgentConnectionEntity never
-- mapped `access`).

ALTER TABLE public.mcp_connector_access DROP CONSTRAINT IF EXISTS mcp_connector_access_abilities_check;
ALTER TABLE public.mcp_connector_access DROP COLUMN IF EXISTS abilities;

ALTER TABLE public.agent_connections DROP CONSTRAINT IF EXISTS agent_connections_access_check;
ALTER TABLE public.agent_connections DROP COLUMN IF EXISTS access;

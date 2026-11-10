-- provider-abilities: forward-only; immutable once on origin/main.
-- The rights of an agent on a provider the workspace connected, in their final shape (owner, 2026-11-10): ONE row per attachment.
-- A row means the agent is ATTACHED to the provider; `abilities` holds the abilities the owner ticked there, by the ability id the
-- gateway's catalogue declares, each `auto` (used by itself) or `ask` (each use waits for a person): {"customer.send": "auto"}.
-- An ability with no key is not held, so an ability shipped later is unticked in every stored row; a provider with no row is not
-- attached, so a newly connected provider is attached to nobody. There is no level beside it: `access` (none, read, write) and
-- `write_mode` are dropped (the table held no row: it was never switched on), and `connector` is named for what it holds.
--
-- A tool that belongs to an ability is decided by this table alone for a workspace's agents, so the tool grants the seed wrote for the
-- ledger tools of an agent (the bookkeeping agent) are removed; the engine's own internal agent (module `nivo`, the caller of a
-- module's declared jobs) keeps its rows, which are wiring, not an owner's right.

ALTER TABLE public.mcp_connector_access DROP COLUMN access;
ALTER TABLE public.mcp_connector_access DROP COLUMN write_mode;
ALTER TABLE public.mcp_connector_access RENAME COLUMN connector TO provider;
ALTER TABLE public.mcp_connector_access ADD COLUMN abilities jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.mcp_connector_access ADD CONSTRAINT mcp_connector_access_abilities_check CHECK ((jsonb_typeof(abilities) = 'object'::text));

DELETE FROM public.mcp_tool_grants g
 USING public.agents a
 WHERE a.id = g.agent_id
   AND a.module <> 'nivo'
   AND g.updated_by IS NULL
   AND g.tool IN ('ledger.append', 'ledger.void', 'ledger.status');

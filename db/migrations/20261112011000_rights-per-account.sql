-- rights-per-account: forward-only; immutable once on origin/main.
-- An agent's rights are held per CONNECTED ACCOUNT (owner, 2026-11-10): one row of public.mcp_connector_access is one agent attached
-- to one connection (one Zalo OA, one bank account, one sheet), with the abilities ticked on that account. Until now the row was keyed
-- by the provider name, so a shop with two accounts of one provider could give an agent both or neither.
--
-- Existing rows keep what they mean today: a row (agent, provider) becomes one row per working connection of that provider in the
-- workspace, each with the same ticks (an agent that could act on "SePay" can act on every SePay account the shop has now; the owner
-- narrows it from there). A row whose provider has no working connection attaches to nothing and is dropped. `provider` stays on the
-- row as the provider of its connection, so a call is judged without reading the connection.
--
-- public.mcp_default_accounts: the one account of a kind a workspace uses by default where a tool must not choose between accounts by
-- itself. Used for kind `payment`: the shop's default receiving account, on which a payment QR is drawn. A workspace with exactly one
-- working account of the kind needs no row: that account is the default.

ALTER TABLE public.mcp_connector_access DROP CONSTRAINT mcp_connector_access_agent_connector_unique;
ALTER TABLE public.mcp_connector_access ADD COLUMN connection_id uuid REFERENCES public.connections(id) ON DELETE CASCADE;

INSERT INTO public.mcp_connector_access (workspace_id, agent_id, provider, abilities, updated_by, connection_id)
SELECT x.workspace_id, x.agent_id, x.provider, x.abilities, x.updated_by, c.id
  FROM public.mcp_connector_access x
  JOIN public.connections c ON c.workspace_id = x.workspace_id AND c.provider = x.provider AND c.status = 'connected'
 WHERE x.connection_id IS NULL;

DELETE FROM public.mcp_connector_access WHERE connection_id IS NULL;

ALTER TABLE public.mcp_connector_access ALTER COLUMN connection_id SET NOT NULL;
ALTER TABLE public.mcp_connector_access ADD CONSTRAINT mcp_connector_access_agent_connection_unique UNIQUE (agent_id, connection_id);
CREATE INDEX mcp_connector_access_connection ON public.mcp_connector_access USING btree (connection_id);

CREATE TABLE public.mcp_default_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    kind text NOT NULL,
    connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mcp_default_accounts_kind_check CHECK ((kind ~ '^[a-z][a-z0-9_-]{1,30}$'::text)),
    CONSTRAINT mcp_default_accounts_workspace_kind_unique UNIQUE (workspace_id, kind)
);

CREATE TRIGGER mcp_default_accounts_set_updated_at BEFORE UPDATE ON public.mcp_default_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.mcp_default_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mcp_default_accounts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mcp_default_accounts TO app_be;
CREATE POLICY mcp_default_accounts_app_be_all ON public.mcp_default_accounts TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

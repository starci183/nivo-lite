-- mcp-connector-access: forward-only; immutable once on origin/main.
-- What each agent of a workspace may do on each provider connector: `none` (the default: no row is none too), `read` (read the
-- external system) or `write` (read and write it), and for `write` whether it writes alone (`auto`) or each write waits for a person's
-- approval (`ask`). An agent holds rows only in the provider groups its module declares (messaging: zalo_oa, telegram, meta; payment:
-- sepay, payos; books: google); the gateway refuses a row outside them when it is set, and judges every provider tool call of the agent
-- against its row.
-- NIVO's own business tools are not judged here: they run under the access of the group that owns the provider they touch.

CREATE TABLE public.mcp_connector_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    connector text NOT NULL,
    access text DEFAULT 'none'::text NOT NULL,
    write_mode text DEFAULT 'ask'::text NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mcp_connector_access_connector_check CHECK ((connector ~ '^[a-z][a-z0-9_-]{1,30}$'::text)),
    CONSTRAINT mcp_connector_access_access_check CHECK ((access = ANY (ARRAY['none'::text, 'read'::text, 'write'::text]))),
    CONSTRAINT mcp_connector_access_write_mode_check CHECK ((write_mode = ANY (ARRAY['auto'::text, 'ask'::text]))),
    CONSTRAINT mcp_connector_access_agent_connector_unique UNIQUE (agent_id, connector)
);

CREATE INDEX mcp_connector_access_workspace ON public.mcp_connector_access USING btree (workspace_id, connector);

ALTER TABLE public.mcp_connector_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mcp_connector_access FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mcp_connector_access TO app_be;
CREATE POLICY mcp_connector_access_app_be_all ON public.mcp_connector_access TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

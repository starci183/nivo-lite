-- NIVO MCP gateway: one tool surface per workspace over native adapters and remote MCP servers,
-- per-agent grants (default deny), the audit log, identity links and the Sales <-> CSKH conversation ownership history.
-- Additive only. Contract: be/docs/guides/mcp-gateway.md.

CREATE TABLE public.mcp_connectors (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    key text NOT NULL,
    name text NOT NULL,
    kind text NOT NULL,
    url text,
    credential_ref text,
    status text DEFAULT 'active'::text NOT NULL,
    contract_version text DEFAULT ''::text NOT NULL,
    timeout_ms integer DEFAULT 4000 NOT NULL,
    tool_catalog jsonb DEFAULT '[]'::jsonb NOT NULL,
    catalog_hash text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mcp_connectors_key_check CHECK ((key ~ '^[a-z][a-z0-9-]{1,30}$'::text)),
    CONSTRAINT mcp_connectors_kind_check CHECK ((kind = ANY (ARRAY['native'::text, 'remote'::text]))),
    CONSTRAINT mcp_connectors_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text, 'degraded'::text]))),
    CONSTRAINT mcp_connectors_remote_url_check CHECK (((kind = 'native'::text) OR (url ~ '^https?://'::text))),
    CONSTRAINT mcp_connectors_credential_ref_check CHECK (((credential_ref IS NULL) OR (credential_ref ~ '^[A-Z][A-Z0-9_]{2,80}$'::text))),
    CONSTRAINT mcp_connectors_timeout_check CHECK (((timeout_ms >= 500) AND (timeout_ms <= 15000))),
    CONSTRAINT mcp_connectors_workspace_key_unique UNIQUE (workspace_id, key)
);

CREATE TABLE public.mcp_tool_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    tool text NOT NULL,
    mode text DEFAULT 'never'::text NOT NULL,
    limit_vnd bigint,
    constraints jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mcp_tool_grants_tool_check CHECK ((tool ~ '^[a-z][a-z0-9-]{1,30}\.([a-zA-Z][a-zA-Z0-9_.]{1,80}|\*)$'::text)),
    CONSTRAINT mcp_tool_grants_mode_check CHECK ((mode = ANY (ARRAY['auto'::text, 'ask'::text, 'never'::text]))),
    CONSTRAINT mcp_tool_grants_limit_vnd_check CHECK (((limit_vnd IS NULL) OR (limit_vnd >= 0))),
    CONSTRAINT mcp_tool_grants_constraints_check CHECK ((jsonb_typeof(constraints) = 'array'::text)),
    CONSTRAINT mcp_tool_grants_agent_tool_unique UNIQUE (agent_id, tool)
);

CREATE TABLE public.mcp_call_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    connector text NOT NULL,
    tool text NOT NULL,
    agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
    conversation_id uuid,
    work_item_id uuid,
    args_masked jsonb DEFAULT '{}'::jsonb NOT NULL,
    args_hash text DEFAULT ''::text NOT NULL,
    outcome text NOT NULL,
    error_code text,
    result_summary text DEFAULT ''::text NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    approved_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mcp_call_log_outcome_check CHECK ((outcome = ANY (ARRAY['ok'::text, 'error'::text, 'refused'::text, 'approval'::text, 'timeout'::text, 'circuit_open'::text])))
);
CREATE INDEX mcp_call_log_ws_time ON public.mcp_call_log USING btree (workspace_id, created_at DESC);

CREATE TABLE public.conversation_ownership_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
    from_agent_id uuid,
    to_agent_id uuid NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversation_ownership_events_reason_length CHECK ((char_length(reason) >= 1 AND char_length(reason) <= 400))
);
CREATE INDEX conversation_ownership_events_conversation ON public.conversation_ownership_events USING btree (conversation_id, created_at DESC);

ALTER TABLE public.mcp_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tool_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_ownership_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mcp_connectors FROM anon, authenticated;
REVOKE ALL ON TABLE public.mcp_tool_grants FROM anon, authenticated;
REVOKE ALL ON TABLE public.mcp_call_log FROM anon, authenticated;
REVOKE ALL ON TABLE public.conversation_ownership_events FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.mcp_connectors TO app_be;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mcp_tool_grants TO app_be;
GRANT SELECT, INSERT ON TABLE public.mcp_call_log TO app_be;
GRANT SELECT, INSERT ON TABLE public.conversation_ownership_events TO app_be;

CREATE POLICY mcp_connectors_app_be_all ON public.mcp_connectors TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY mcp_tool_grants_app_be_all ON public.mcp_tool_grants TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY mcp_call_log_app_be_select ON public.mcp_call_log FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));
CREATE POLICY mcp_call_log_app_be_insert ON public.mcp_call_log FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY conversation_ownership_events_app_be_select ON public.conversation_ownership_events FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));
CREATE POLICY conversation_ownership_events_app_be_insert ON public.conversation_ownership_events FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

-- The approval of a gated gateway call (an argument over its constraint, an amount over the limit, a tool in "ask" mode).
INSERT INTO public.authority_actions (action, module_key, sort_order, default_mode, default_limit_vnd, default_required_fields, amount_limit, max_mode, label) VALUES
    ('gateway_call', 'chatbot', 40, 'ask', NULL, '{}', false, NULL, '{"en": "Connector call needing approval", "vi": "Lệnh kết nối cần duyệt"}')
ON CONFLICT DO NOTHING;

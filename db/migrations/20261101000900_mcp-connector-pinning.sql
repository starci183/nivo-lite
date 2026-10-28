-- NIVO MCP gateway: schema pinning and health of remote connectors.
-- tool_catalog keeps the live snapshot (each entry carries the sha256 of its name, description and input schema); approved_catalog
-- keeps the { name, hash } pairs an owner or manager approved. A remote tool runs only while its live hash equals the approved one.
-- checked_at is when the last health check or catalog read answered (or failed). Additive only.

ALTER TABLE public.mcp_connectors
    ADD COLUMN approved_catalog jsonb DEFAULT '[]'::jsonb NOT NULL,
    ADD COLUMN approved_by uuid,
    ADD COLUMN approved_at timestamp with time zone,
    ADD COLUMN checked_at timestamp with time zone,
    ADD CONSTRAINT mcp_connectors_approved_catalog_check CHECK ((jsonb_typeof(approved_catalog) = 'array'::text));

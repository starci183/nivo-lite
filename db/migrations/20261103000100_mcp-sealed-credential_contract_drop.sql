-- v0.3.3: the credential of a remote MCP connector is sealed per workspace in the database and set from the console, the same way
-- a channel connection's credential is (AES-256-GCM under CHANNEL_TOKEN_KEY, through the connection-secrets capability). The
-- connector no longer names a gateway environment variable: credential_ref is dropped.
-- credential_state: none = the server takes no credential; needed = it takes one and none is stored yet; set = credential_sealed
-- holds it. credential_sealed is never selected into a console read.
-- Existing rows that named a credential (credential_ref) become "needed": the gateway environment variables they named are
-- retired with this release, so their value is not carried over; an owner or manager enters it once in the console.

ALTER TABLE public.mcp_connectors
    ADD COLUMN credential_state text DEFAULT 'none'::text NOT NULL,
    ADD COLUMN credential_sealed text,
    ADD COLUMN credential_set_by uuid,
    ADD COLUMN credential_set_at timestamp with time zone;

UPDATE public.mcp_connectors SET credential_state = 'needed' WHERE credential_ref IS NOT NULL;

ALTER TABLE public.mcp_connectors
    ADD CONSTRAINT mcp_connectors_credential_state_check CHECK ((credential_state = ANY (ARRAY['none'::text, 'needed'::text, 'set'::text]))),
    ADD CONSTRAINT mcp_connectors_credential_sealed_check CHECK (((credential_state = 'set'::text) = (credential_sealed IS NOT NULL))),
    ADD CONSTRAINT mcp_connectors_credential_remote_check CHECK (((kind = 'remote'::text) OR (credential_state = 'none'::text)));

ALTER TABLE public.mcp_connectors DROP CONSTRAINT mcp_connectors_credential_ref_check;
ALTER TABLE public.mcp_connectors DROP COLUMN credential_ref;

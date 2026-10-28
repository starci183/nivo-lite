-- A per-agent credential for the MCP endpoint: an API key may be bound to one agent of its workspace. Such a key carries only
-- the `tools:call` scope and names the agent the gateway serves; deleting the agent deletes its keys, so a removed agent's key
-- stops working at once. Keys without an agent are the public API keys they always were.

ALTER TABLE public.api_keys
    ADD COLUMN agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
    ADD CONSTRAINT api_keys_agent_scope_check CHECK (((agent_id IS NULL) OR (scopes = ARRAY['tools:call'::text])));

CREATE INDEX api_keys_agent_id_idx ON public.api_keys USING btree (agent_id) WHERE (agent_id IS NOT NULL);

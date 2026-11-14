-- agent-account-default: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by SBX3-ACC (source only): the restart owner applies it with the code that reads it.
-- An agent may hold several attached accounts of ONE provider (a live and a sandbox account side by side). Which of them a step's call uses is
-- decided by the engine in this order: the account the run's trigger came in on, an account the run already used, then the agent's DEFAULT
-- account of that provider, which the owner sets and which is stored ON THE ATTACHMENT: public.mcp_connector_access.is_default.
-- Expand only: every existing attachment is no default (false); no behaviour of a single-account agent changes.
-- At most one default per (agent, provider): the partial unique index below.
ALTER TABLE public.mcp_connector_access ADD COLUMN is_default boolean DEFAULT false NOT NULL;
CREATE UNIQUE INDEX mcp_connector_access_default_one ON public.mcp_connector_access USING btree (agent_id, provider) WHERE is_default;

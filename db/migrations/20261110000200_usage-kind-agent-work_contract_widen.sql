-- agent-work: a tag or background turn of an agent is metered under the new usage kind `agent_work` (a customer turn on the core road
-- keeps `chat_reply`). Additive: the kind check is widened by one value; no row changes. `kind` is a text column with a CHECK, not a
-- Postgres enum, so the new value is usable at once, and the quota function already sums every kind but `guide` into tokens and credits.

ALTER TABLE public.ai_usage_events DROP CONSTRAINT ai_usage_events_kind_check;
ALTER TABLE public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_kind_check
    CHECK ((kind = ANY (ARRAY['chat_reply'::text, 'setup'::text, 'owner_chat'::text, 'relay'::text, 'embedding'::text, 'engine'::text, 'guide'::text, 'brain'::text, 'office_command'::text, 'agent_work'::text])));

-- ai-usage-cached-tokens: forward-only; immutable once on origin/main.
-- How much of a model call's prompt the provider served from its prompt cache. The engine lays every prompt out stable part first
-- (the agent's craft and tool set, the shop's policy values, the step), so a provider that caches by prefix reuses it; this column
-- is where that is measured, per call. The cached tokens are a part of prompt_tokens, never more; a call whose provider reported
-- none, and every call booked before this column, counts zero.

ALTER TABLE public.ai_usage_events ADD COLUMN cached_tokens integer DEFAULT 0 NOT NULL;
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_cached_tokens_check CHECK (cached_tokens >= 0 AND cached_tokens <= prompt_tokens);

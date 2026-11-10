-- ai-usage-model-choice: forward-only; immutable once on origin/main.
-- The model of a graph node's call, beside what it cost (owner, 2026-11-10: a model per node, Auto by rule). `model` (existing) stays
-- the model that SERVED the call. `declared_model` is what the node declared: `auto` or a model id (`claude-sonnet-5-5`,
-- `deepseek/deepseek-v4.1-flash`); null for a fixed task of the app. `model_provider` is the provider of the served model
-- (`anthropic`, `openrouter`). `model_reason` is why the call went to that model (`explicit`, `declared`, `default`, `default-no-key`,
-- `unknown-model`, `auto-light`, `auto-heavy`, `auto-step-up`, `auto-other-provider`, `auto-failover`, `step-pinned`). Every row booked
-- before this migration, and every fixed task, has nulls. Apply BEFORE the dist that carries this code: TypeORM inserts every entity
-- column, so an unmigrated database would lose every usage row.

ALTER TABLE public.ai_usage_events ADD COLUMN declared_model text;
ALTER TABLE public.ai_usage_events ADD COLUMN model_provider text;
ALTER TABLE public.ai_usage_events ADD COLUMN model_reason text;
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_declared_model_check CHECK (declared_model IS NULL OR char_length(declared_model) <= 120);
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_model_provider_check CHECK (model_provider IS NULL OR char_length(model_provider) <= 40);
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_model_reason_check CHECK (model_reason IS NULL OR char_length(model_reason) <= 40);

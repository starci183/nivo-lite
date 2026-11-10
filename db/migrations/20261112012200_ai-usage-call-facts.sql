-- ai-usage-call-facts: forward-only; immutable once on origin/main.
-- What one model call was and how it went, beside what it cost, so the run page can show where the time and the hidden reasoning of
-- a run went, per call kind. `purpose` is the call kind (`<node id>:<tag>` of a graph node's call, e.g. accounting.match-payment:agent;
-- null for a fixed task of the app). `reasoning_tokens` is the part of completion_tokens the model spent on hidden reasoning (billed,
-- never read). `duration_ms` is the wall time of the try that answered; `try_number` which try of the call it was (1 to 3: a 3 means
-- two tries failed before it, and failed tries are never booked); `upstream` the upstream of the endpoint that served it (OpenRouter's
-- `provider`, e.g. Wafer); `finish_reason` why the model stopped (stop, tool_calls). Every row booked before this migration, and a
-- call whose endpoint did not say, has zero reasoning and nulls elsewhere.

ALTER TABLE public.ai_usage_events ADD COLUMN purpose text;
ALTER TABLE public.ai_usage_events ADD COLUMN reasoning_tokens integer DEFAULT 0 NOT NULL;
ALTER TABLE public.ai_usage_events ADD COLUMN duration_ms integer;
ALTER TABLE public.ai_usage_events ADD COLUMN try_number smallint;
ALTER TABLE public.ai_usage_events ADD COLUMN upstream text;
ALTER TABLE public.ai_usage_events ADD COLUMN finish_reason text;
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_reasoning_tokens_check CHECK (reasoning_tokens >= 0 AND reasoning_tokens <= completion_tokens);
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_duration_ms_check CHECK (duration_ms IS NULL OR duration_ms >= 0);
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_try_number_check CHECK (try_number IS NULL OR (try_number >= 1 AND try_number <= 10));
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_purpose_check CHECK (purpose IS NULL OR char_length(purpose) <= 200);
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_upstream_check CHECK (upstream IS NULL OR char_length(upstream) <= 120);
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_finish_reason_check CHECK (finish_reason IS NULL OR char_length(finish_reason) <= 40);

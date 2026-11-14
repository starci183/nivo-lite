-- drop-dead-engine-tables: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the DECOUPLE lane: RESTART-R applies it.
-- Owner rule R28 (2026-11-14, "the source holds no legacy"): engine tables whose only reader and writer left the source are dropped.
-- `agent_speaker_queue`: the hand-offs a tag kept back while a third agent held a customer conversation. Its door (the tag door's
-- speaker part: keep / take next / hand back) only ever ran with a conversations-side visibility port bound, and no app bound one; the
-- tag door now writes a plain tag's wake and nothing else, and a workflow call is an event of the one pipeline (`deliver`). No other
-- table references it.

DROP TABLE IF EXISTS public.agent_speaker_queue;

-- `conversation_holds`: the agent that kept a customer's route for itself between turns (the consult hold). Coordinator ruling R35
-- (2026-11-14): the one-run-in-flight-per-subject rule replaced it, and its service, store and entity left the source. No other table
-- references it; its trigger, policy and index go with it.
DROP TABLE IF EXISTS public.conversation_holds;

-- `agents.can_tag_agent_ids`: the agents an agent might pass work to (the tag grant lists). Coordinator ruling R43 (2026-11-14):
-- nothing enforced them (a workflow call is an event of the one pipeline, checked by the call guard, never by this list), so the
-- column, its self-tag CHECK, the module grant writer and the GraphQL fields left the source. Dropping the column drops the CHECK.
ALTER TABLE public.agents DROP COLUMN IF EXISTS can_tag_agent_ids;

-- chat-message-agent-message: forward-only; immutable once on origin/main.
-- A line an agent says as a card keeps the structured message in ref.agent_message (JSON text) beside its readable text; the check allowed a text line no ref at all, so the line could not be stored. A text line may now carry ref with only that key; every other rule of the check is as it was.

ALTER TABLE public.chat_room_messages DROP CONSTRAINT chat_room_messages_ref_check;
ALTER TABLE public.chat_room_messages ADD CONSTRAINT chat_room_messages_ref_check CHECK (
    (kind = 'report' AND jsonb_typeof(ref) = 'object' AND ref ? 'run_id' AND (ref->>'run_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    OR (kind = 'approval' AND jsonb_typeof(ref) = 'object' AND ref ? 'decision_id' AND (ref->>'decision_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    OR (kind = 'text' AND author_kind = 'agent' AND jsonb_typeof(ref) = 'object' AND jsonb_typeof(ref->'agent_message') = 'string')
    OR (kind IN ('text', 'system') AND ref IS NULL));

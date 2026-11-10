-- chat-room-message-reactions: forward-only; immutable once on origin/main.
-- Reactions on chat messages, Zalo style: one row per member and emoji, `count` is how many times that member tapped it. A message may quote another message of its room (`reply_to`), and a forwarded message keeps whose words it carries in ref.forwarded_from (beside ref.agent_message when it forwards an agent card).

ALTER TABLE public.chat_room_messages ADD COLUMN reply_to uuid REFERENCES public.chat_room_messages(id) ON DELETE SET NULL;
-- the replies of a message
CREATE INDEX chat_room_messages_reply_idx ON public.chat_room_messages USING btree (reply_to) WHERE reply_to IS NOT NULL;

ALTER TABLE public.chat_room_messages DROP CONSTRAINT chat_room_messages_ref_check;
ALTER TABLE public.chat_room_messages ADD CONSTRAINT chat_room_messages_ref_check CHECK (
    (kind = 'report' AND jsonb_typeof(ref) = 'object' AND ref ? 'run_id' AND (ref->>'run_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    OR (kind = 'approval' AND jsonb_typeof(ref) = 'object' AND ref ? 'decision_id' AND (ref->>'decision_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    OR (kind = 'text' AND author_kind = 'agent' AND jsonb_typeof(ref) = 'object' AND jsonb_typeof(ref->'agent_message') = 'string')
    OR (kind = 'text' AND author_kind = 'user' AND jsonb_typeof(ref) = 'object' AND jsonb_typeof(ref->'forwarded_from') = 'string' AND char_length(ref->>'forwarded_from') <= 200 AND (NOT ref ? 'agent_message' OR jsonb_typeof(ref->'agent_message') = 'string'))
    OR (kind IN ('text', 'system') AND ref IS NULL));

CREATE TABLE public.chat_room_message_reactions (
    message_id uuid NOT NULL REFERENCES public.chat_room_messages(id) ON DELETE CASCADE,
    room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    member_kind text NOT NULL,
    member_id uuid NOT NULL,
    emoji text NOT NULL,
    -- how many times this member tapped this emoji on this message
    count integer NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    PRIMARY KEY (message_id, member_kind, member_id, emoji),
    CONSTRAINT chat_room_message_reactions_kind_check CHECK (member_kind IN ('user', 'agent')),
    CONSTRAINT chat_room_message_reactions_emoji_check CHECK (char_length(emoji) BETWEEN 1 AND 16),
    CONSTRAINT chat_room_message_reactions_count_check CHECK (count BETWEEN 1 AND 999)
);
-- the reactions of the messages of a room
CREATE INDEX chat_room_message_reactions_room_idx ON public.chat_room_message_reactions USING btree (room_id, message_id);

CREATE TRIGGER chat_room_message_reactions_set_updated_at BEFORE UPDATE ON public.chat_room_message_reactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.chat_room_message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_room_message_reactions_app_be_select ON public.chat_room_message_reactions FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY chat_room_message_reactions_app_be_insert ON public.chat_room_message_reactions FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY chat_room_message_reactions_app_be_update ON public.chat_room_message_reactions FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY chat_room_message_reactions_app_be_delete ON public.chat_room_message_reactions FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.chat_room_message_reactions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_room_message_reactions TO app_be;

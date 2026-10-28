-- Stable actors are additive: historical messages remain unattributed rather than guessed from names.
ALTER TABLE public.messages ADD COLUMN author_user_id uuid;
ALTER TABLE public.agent_messages ADD COLUMN author_user_id uuid;
COMMENT ON COLUMN public.messages.author_user_id IS 'The proven workspace account that posted this human message; NULL for legacy or automated lines.';
COMMENT ON COLUMN public.agent_messages.author_user_id IS 'The proven workspace account that submitted this message; NULL for customer, legacy or automated lines.';
CREATE INDEX messages_author_cursor ON public.messages (workspace_id, author_user_id, created_at DESC, id DESC)
    WHERE author_user_id IS NOT NULL;
CREATE INDEX messages_room_author_cursor ON public.messages (workspace_id, room, author_user_id, created_at DESC, id DESC)
    WHERE author_user_id IS NOT NULL;
CREATE INDEX agent_messages_author_cursor ON public.agent_messages (workspace_id, conversation_id, author_user_id, created_at DESC, id DESC)
    WHERE author_user_id IS NOT NULL;

-- The same admission predicate serves backend markers and private realtime channel policies.
-- Department rooms follow the existing Office APIs: all active workspace members may enter.
CREATE FUNCTION be_access.chat_target_member(p_workspace uuid, p_user uuid, p_room text, p_conversation uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
    SELECT (current_setting('role', true) = 'app_be'
            OR (current_setting('role', true) = 'none' AND pg_has_role(session_user, 'app_be', 'USAGE'))
            OR p_user = auth.uid())
       AND EXISTS (SELECT 1 FROM public.workspace_members m
                   WHERE m.workspace_id = p_workspace AND m.user_id = p_user AND m.status = 'active')
       AND CASE WHEN p_conversation IS NOT NULL THEN
                    p_room IS NULL AND EXISTS (SELECT 1 FROM public.agent_conversations c
                                              WHERE c.id = p_conversation AND c.workspace_id = p_workspace)
                ELSE p_room IS NULL OR EXISTS (SELECT 1 FROM public.office_rooms r
                                              WHERE r.workspace_id = p_workspace AND r.key = p_room)
           END;
$$;
REVOKE ALL ON FUNCTION be_access.chat_target_member(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA be_access TO authenticated;
GRANT EXECUTE ON FUNCTION be_access.chat_target_member(uuid, uuid, text, uuid) TO app_be, authenticated;

-- A fetched cursor advances only to an identified persisted message, never the current wall clock.
-- Room reads retain office_rooms_reads as their source of truth. Conversation reads live here without calculating unread.
CREATE TABLE public.chat_markers (
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    room text NOT NULL DEFAULT '',
    conversation_id uuid REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
    target_key text GENERATED ALWAYS AS (COALESCE(conversation_id::text, room)) STORED,
    delivered_at timestamptz,
    delivered_message_id uuid,
    read_at timestamptz,
    read_message_id uuid,
    muted boolean NOT NULL DEFAULT false,
    PRIMARY KEY (workspace_id, user_id, target_key),
    FOREIGN KEY (workspace_id, user_id) REFERENCES public.workspace_members(workspace_id, user_id) ON DELETE CASCADE,
    CONSTRAINT chat_markers_target CHECK (
        (conversation_id IS NOT NULL AND room = '') OR
        (conversation_id IS NULL AND room = ANY (ARRAY['', 'executive', 'frontdesk', 'sales', 'marketing', 'care', 'accounting']))),
    CONSTRAINT chat_markers_delivered_cursor CHECK ((delivered_at IS NULL) = (delivered_message_id IS NULL)),
    CONSTRAINT chat_markers_read_cursor CHECK ((read_at IS NULL) = (read_message_id IS NULL))
);
CREATE INDEX chat_markers_delivered_cursor
    ON public.chat_markers (workspace_id, target_key, delivered_at, delivered_message_id)
    WHERE delivered_at IS NOT NULL;
ALTER TABLE public.chat_markers ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_markers_app_be_select ON public.chat_markers FOR SELECT TO app_be
    USING (be_access.chat_target_member(workspace_id, user_id, NULLIF(room, ''), conversation_id));
CREATE POLICY chat_markers_app_be_insert ON public.chat_markers FOR INSERT TO app_be
    WITH CHECK (be_access.chat_target_member(workspace_id, user_id, NULLIF(room, ''), conversation_id));
CREATE POLICY chat_markers_app_be_update ON public.chat_markers FOR UPDATE TO app_be
    USING (be_access.chat_target_member(workspace_id, user_id, NULLIF(room, ''), conversation_id))
    WITH CHECK (be_access.chat_target_member(workspace_id, user_id, NULLIF(room, ''), conversation_id));
CREATE POLICY chat_markers_app_be_delete ON public.chat_markers FOR DELETE TO app_be
    USING (be_access.chat_target_member(workspace_id, user_id, NULLIF(room, ''), conversation_id));
REVOKE ALL ON public.chat_markers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_markers TO app_be;

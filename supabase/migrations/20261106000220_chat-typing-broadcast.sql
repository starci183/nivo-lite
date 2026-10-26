-- Typing is a short-lived private broadcast. No application presence table or browser data-table access is added.
-- The backend alone authors identities and events; authenticated clients may only receive an admitted target's broadcast.
CREATE FUNCTION be_access.broadcast_private(p_topic text, p_event text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    PERFORM realtime.send(p_payload, p_event, p_topic, true);
END;
$$;

REVOKE ALL ON FUNCTION be_access.broadcast_private(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION be_access.broadcast_private(text, text, jsonb) TO app_be;

CREATE FUNCTION be_access.chat_typing_topic_member(p_topic text, p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
    SELECT COALESCE(p_user = auth.uid(), false)
       AND CASE WHEN cardinality(string_to_array(p_topic, ':')) = 4
                     AND split_part(p_topic, ':', 1) = 'chat-typing'
                     AND split_part(p_topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN CASE WHEN split_part(p_topic, ':', 3) = 'room' THEN
                              be_access.chat_target_member(split_part(p_topic, ':', 2)::uuid, p_user,
                                  NULLIF(split_part(p_topic, ':', 4), 'office'), NULL)
                          WHEN split_part(p_topic, ':', 3) = 'conversation'
                               AND split_part(p_topic, ':', 4) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                              be_access.chat_target_member(split_part(p_topic, ':', 2)::uuid, p_user,
                                  NULL, split_part(p_topic, ':', 4)::uuid)
                          ELSE false END
                ELSE false END;
$$;

REVOKE ALL ON FUNCTION be_access.chat_typing_topic_member(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION be_access.chat_typing_topic_member(text, uuid) TO authenticated;

CREATE POLICY chat_typing_receive ON realtime.messages
FOR SELECT TO authenticated
USING (
    extension = 'broadcast'
    AND topic = (SELECT realtime.topic())
    AND be_access.chat_typing_topic_member((SELECT realtime.topic()), (SELECT auth.uid()))
);

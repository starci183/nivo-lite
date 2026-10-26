import { sql } from "@modules/platform/database"

/** Shared backend/private realtime target admission ($1 workspace, $2 account, $3 room, $4 conversation). */
export const CHAT_TARGET_MEMBER = sql`SELECT be_access.chat_target_member($1::uuid, $2::uuid, $3::text, $4::uuid) AS allowed LIMIT 1`

/** Resolves only a message actually fetched from the scoped target ($1 workspace, $2 room, $3 conversation, $4 message). */
export const CHAT_MESSAGE_CURSOR = sql`
    SELECT to_json(m.created_at) #>> '{}' AS created_at FROM public.messages m
    WHERE $3::uuid IS NULL AND m.workspace_id = $1::uuid AND m.id = $4::uuid
      AND ($2::text IS NULL OR m.room = $2::text)
    UNION ALL
    SELECT to_json(m.created_at) #>> '{}' AS created_at FROM public.agent_messages m
    WHERE $3::uuid IS NOT NULL AND m.workspace_id = $1::uuid AND m.conversation_id = $3::uuid AND m.id = $4::uuid
    LIMIT 1`

/** Advances a member's fetched cursor without regressing it ($1 workspace, $2 account, $3 stored room, $4 conversation, $5 persisted instant, $6 message). */
export const MARK_CHAT_DELIVERED = sql`
    INSERT INTO public.chat_markers (workspace_id, user_id, room, conversation_id, delivered_at, delivered_message_id)
    VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::timestamptz, $6::uuid)
    ON CONFLICT (workspace_id, user_id, target_key) DO UPDATE
    SET delivered_at = EXCLUDED.delivered_at, delivered_message_id = EXCLUDED.delivered_message_id
    WHERE public.chat_markers.delivered_at IS NULL OR
          (public.chat_markers.delivered_at, public.chat_markers.delivered_message_id) <
          (EXCLUDED.delivered_at, EXCLUDED.delivered_message_id)`

/** Advances read and delivered cursors together ($1 workspace, $2 account, $3 stored room, $4 conversation, $5 persisted instant, $6 message). */
export const MARK_CHAT_READ = sql`
    INSERT INTO public.chat_markers
            (workspace_id, user_id, room, conversation_id, delivered_at, delivered_message_id, read_at, read_message_id)
        VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::timestamptz, $6::uuid, $5::timestamptz, $6::uuid)
        ON CONFLICT (workspace_id, user_id, target_key) DO UPDATE
        SET delivered_at = GREATEST(public.chat_markers.delivered_at, EXCLUDED.delivered_at),
            delivered_message_id = CASE WHEN public.chat_markers.delivered_at IS NULL OR
                (public.chat_markers.delivered_at, public.chat_markers.delivered_message_id) <
                (EXCLUDED.delivered_at, EXCLUDED.delivered_message_id)
                THEN EXCLUDED.delivered_message_id ELSE public.chat_markers.delivered_message_id END,
            read_at = GREATEST(public.chat_markers.read_at, EXCLUDED.read_at),
            read_message_id = CASE WHEN public.chat_markers.read_at IS NULL OR
                (public.chat_markers.read_at, public.chat_markers.read_message_id) <
                (EXCLUDED.read_at, EXCLUDED.read_message_id)
                THEN EXCLUDED.read_message_id ELSE public.chat_markers.read_message_id END`

/** Changes only this account's mute preference ($1 workspace, $2 account, $3 stored room, $4 conversation, $5 muted). */
export const SET_CHAT_MUTED = sql`
    INSERT INTO public.chat_markers (workspace_id, user_id, room, conversation_id, muted)
    VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::boolean)
    ON CONFLICT (workspace_id, user_id, target_key) DO UPDATE SET muted = EXCLUDED.muted`

/** The caller's newest authored message, bounded active readers and their own preference ($1 workspace, $2 account, $3 room, $4 conversation). */
export const CHAT_MARKER_STATE = sql`
    WITH own_message AS (
        SELECT m.id, m.created_at, m.room FROM public.messages m
        WHERE $4::uuid IS NULL AND m.workspace_id = $1::uuid AND m.author_user_id = $2::uuid
          AND ($3::text IS NULL OR m.room = $3::text)
        UNION ALL
        SELECT m.id, m.created_at, NULL::text AS room FROM public.agent_messages m
        WHERE $4::uuid IS NOT NULL AND m.workspace_id = $1::uuid AND m.conversation_id = $4::uuid AND m.author_user_id = $2::uuid
        ORDER BY created_at DESC, id DESC LIMIT 1
    ), readers AS (
        SELECT wm.user_id AS id, wm.display_name AS name FROM public.workspace_members wm
        CROSS JOIN own_message own
        WHERE wm.workspace_id = $1::uuid AND wm.user_id <> $2::uuid AND wm.status = 'active'
          AND CASE WHEN $4::uuid IS NULL THEN EXISTS (
              SELECT 1 FROM public.office_rooms_reads rd
              LEFT JOIN public.chat_markers exact ON exact.workspace_id = rd.workspace_id
                  AND exact.user_id = rd.user_id AND exact.conversation_id IS NULL AND exact.room = rd.room
              WHERE rd.workspace_id = $1::uuid AND rd.user_id = wm.user_id
                AND rd.room = COALESCE($3::text, '')
                AND (rd.last_read_at > own.created_at OR (rd.last_read_at = own.created_at
                     AND (exact.read_at IS DISTINCT FROM rd.last_read_at OR exact.read_message_id >= own.id))))
          ELSE EXISTS (
              SELECT 1 FROM public.chat_markers s
              WHERE s.workspace_id = $1::uuid AND s.user_id = wm.user_id AND s.conversation_id = $4::uuid
                AND (s.read_at, s.read_message_id) >= (own.created_at, own.id)) END
    ), bounded_readers AS (
        SELECT id, name FROM readers ORDER BY id LIMIT 3
    ), reader_avatars AS MATERIALIZED (
        SELECT id, avatar_url FROM be_access.workspace_member_avatars($1, ARRAY(SELECT id FROM bounded_readers))
    ), delivered AS (
        SELECT 1 FROM public.chat_markers s
        JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id AND wm.user_id = s.user_id AND wm.status = 'active'
        CROSS JOIN own_message own
        WHERE s.workspace_id = $1::uuid AND s.user_id <> $2::uuid
          AND s.target_key = COALESCE($4::uuid::text, $3::text, '')
          AND (s.delivered_at, s.delivered_message_id) >= (own.created_at, own.id)
        LIMIT 1
    )
    SELECT COALESCE((SELECT s.muted FROM public.chat_markers s
                    WHERE s.workspace_id = $1::uuid AND s.user_id = $2::uuid
                      AND s.target_key = COALESCE($4::uuid::text, $3::text, '') LIMIT 1), false) AS muted,
           (SELECT json_build_object('id', own.id,
                    'status', CASE WHEN EXISTS (SELECT 1 FROM readers) THEN 'seen'
                                   WHEN EXISTS (SELECT 1 FROM delivered) THEN 'delivered' ELSE 'sent' END,
                    'seenBy', COALESCE((SELECT json_agg(json_build_object('id', r.id, 'name', r.name,
                                             'avatarSeed', r.id, 'avatarUrl', a.avatar_url) ORDER BY r.id)
                                       FROM bounded_readers r LEFT JOIN reader_avatars a ON a.id = r.id), '[]'::json),
                    'seenByCount', (SELECT count(*)::integer FROM readers))
            FROM own_message own LIMIT 1) AS last_own_message
    LIMIT 1`

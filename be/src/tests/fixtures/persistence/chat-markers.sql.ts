import { sql } from "@modules/platform/database"

/** The receipt table is protected by RLS and grants no browser or anonymous CRUD access. */
export const CHAT_MARKER_PRIVILEGES = sql`
    SELECT c.relrowsecurity AS rls,
           has_table_privilege('app_be', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS backend,
           has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anonymous,
           has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS browser
    FROM pg_class c WHERE c.oid = 'public.chat_markers'::regclass`

/** Writes a preference as the actual backend role ($1 workspace, $2 member, $3 room, $4 conversation). */
export const INSERT_CHAT_MARKER_STATE = sql`
    INSERT INTO public.chat_markers (workspace_id, user_id, room, conversation_id, muted)
    VALUES ($1::uuid, $2::uuid, $3, $4::uuid, true)`

/** The per-target preferences visible to the database role ($1 workspace). */
export const READ_CHAT_MARKER_STATES = sql`
    SELECT user_id, room, conversation_id, muted
    FROM public.chat_markers WHERE workspace_id = $1::uuid ORDER BY user_id, target_key`

/** Mutates a persisted preference under its RLS update policy ($1 workspace, $2 member). */
export const UPDATE_CHAT_MARKER_STATE = sql`
    UPDATE public.chat_markers SET muted = false
    WHERE workspace_id = $1::uuid AND user_id = $2::uuid`

/** Removes a persisted preference under its RLS delete policy ($1 workspace, $2 member). */
export const DELETE_CHAT_MARKER_STATE = sql`
    DELETE FROM public.chat_markers WHERE workspace_id = $1::uuid AND user_id = $2::uuid`

/** Current read and delivery ids make cursor regression observable ($1 workspace, $2 member, $3 target key). */
export const READ_CHAT_MARKER_CURSOR = sql`
    SELECT delivered_message_id, read_message_id
    FROM public.chat_markers
    WHERE workspace_id = $1::uuid AND user_id = $2::uuid AND target_key = $3`

/** Updates an account's current reader label without touching historical message authors ($1 workspace, $2 member, $3 name). */
export const RENAME_CHAT_READER = sql`
    UPDATE public.workspace_members SET display_name = $3 WHERE workspace_id = $1::uuid AND user_id = $2::uuid`

/** Disables a reader after they acknowledged a message ($1 workspace, $2 member). */
export const DISABLE_CHAT_READER = sql`
    UPDATE public.workspace_members SET status = 'disabled' WHERE workspace_id = $1::uuid AND user_id = $2::uuid`

/** An existing room read marker must count as seen without a new receipt write ($1 workspace, $2 member, $3 room, $4 at). */
export const INSERT_LEGACY_ROOM_READ = sql`
    INSERT INTO public.office_rooms_reads (workspace_id, user_id, room, last_read_at)
    VALUES ($1::uuid, $2::uuid, $3, $4::timestamptz)`

/** Stable actor ids survive persistence for both team and conversation message writers ($1 ids). */
export const READ_CHAT_MESSAGE_ACTORS = sql`
    SELECT id, author_user_id FROM public.messages WHERE id = ANY($1::uuid[])
    UNION ALL
    SELECT id, author_user_id FROM public.agent_messages WHERE id = ANY($1::uuid[])
    ORDER BY id`

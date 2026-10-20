import { sql } from "@modules/platform/database"

/**
 * The department rooms of a workspace with what the room list shows: the caller's unread count (lines after their last read that
 * they did not write themselves, capped at 99), the newest line, the members and the pinned documents.
 * $1 workspace, $2 the caller's user id, $3 the caller's display name.
 */
export const LIST_ROOMS = sql`
    SELECT r.key, r.name, r.position,
           LEAST(99, (
               SELECT count(*) FROM public.messages m
               WHERE m.workspace_id = r.workspace_id AND m.room = r.key
                 AND m.created_at > COALESCE(rd.last_read_at, '-infinity'::timestamptz)
                 AND NOT (m.author_kind = 'human' AND m.author_name = $3)))::int AS unread,
           last.body AS last_body, last.author_name AS last_author, to_json(last.created_at) #>> '{}' AS last_at,
           COALESCE((SELECT array_agg(rm.agent_id::text ORDER BY rm.created_at) FROM public.office_rooms_members rm
                     WHERE rm.room_id = r.id AND rm.agent_id IS NOT NULL), '{}'::text[]) AS agent_ids,
           COALESCE((SELECT array_agg(rm.agent_id::text ORDER BY rm.created_at) FROM public.office_rooms_members rm
                     WHERE rm.room_id = r.id AND rm.agent_id IS NOT NULL AND rm.is_home), '{}'::text[]) AS home_agent_ids,
           COALESCE((SELECT array_agg(rm.user_id::text ORDER BY rm.created_at) FROM public.office_rooms_members rm
                     WHERE rm.room_id = r.id AND rm.user_id IS NOT NULL), '{}'::text[]) AS user_ids,
           COALESCE((SELECT json_agg(json_build_object('id', p.id, 'title', p.title, 'href', p.href, 'note', p.note)
                                     ORDER BY p.created_at)
                     FROM public.office_rooms_pins p WHERE p.room_id = r.id), '[]'::json) AS pins
    FROM public.office_rooms r
    LEFT JOIN public.office_rooms_reads rd ON rd.workspace_id = r.workspace_id AND rd.user_id = $2 AND rd.room = r.key
    LEFT JOIN LATERAL (
        SELECT m.body, m.author_name, m.created_at FROM public.messages m
        WHERE m.workspace_id = r.workspace_id AND m.room = r.key
        ORDER BY m.created_at DESC, m.id DESC LIMIT 1
    ) last ON true
    WHERE r.workspace_id = $1
    ORDER BY r.position, r.key
    LIMIT 20`

/** The general Office room as the list shows it: every line of the workspace. Same parameters as LIST_ROOMS. */
export const OFFICE_ROOM_SUMMARY = sql`
    WITH read_marker AS (
        SELECT rd.last_read_at FROM public.office_rooms_reads rd
        WHERE rd.workspace_id = $1 AND rd.user_id = $2 AND rd.room = '' LIMIT 1
    ), newest AS (
        SELECT m.body, m.author_name, m.created_at FROM public.messages m
        WHERE m.workspace_id = $1 ORDER BY m.created_at DESC, m.id DESC LIMIT 1
    )
    SELECT LEAST(99, (
               SELECT count(*) FROM public.messages m
               WHERE m.workspace_id = $1
                 AND m.created_at > COALESCE((SELECT last_read_at FROM read_marker LIMIT 1), '-infinity'::timestamptz)
                 AND NOT (m.author_kind = 'human' AND m.author_name = $3)))::int AS unread,
           (SELECT body FROM newest LIMIT 1) AS last_body,
           (SELECT author_name FROM newest LIMIT 1) AS last_author,
           (SELECT to_json(created_at) #>> '{}' FROM newest LIMIT 1) AS last_at`

/** Records that the caller read a room up to now ($3 the room key, '' for the Office room). */
export const MARK_ROOM_READ = sql`SELECT public.mark_office_room_read($1, $2, $3)`

/** Creates the six department rooms of a workspace and seats its active agents (idempotent). */
export const ENSURE_ROOMS = sql`SELECT public.ensure_office_rooms($1) AS opened`

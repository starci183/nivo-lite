import { sql } from "@modules/platform/database"

/**
 * The department rooms of a workspace with what the room list shows: the caller's unread count (lines after their last read that
 * they did not write themselves, capped at 99; their own lines are recognised by author_user_id, and by display name only on legacy lines that carry no account id), the newest line, the members and the pinned documents.
 * $1 workspace, $2 the caller's user id, $3 the caller's display name (legacy lines only).
 */
export const LIST_ROOMS = sql`
    SELECT r.key, r.name, r.position,
           LEAST(99, (
               SELECT count(*) FROM public.messages m
               WHERE m.workspace_id = r.workspace_id AND m.room = r.key
                 AND m.created_at > COALESCE(rd.last_read_at, '-infinity'::timestamptz)
                 AND m.author_user_id IS DISTINCT FROM $2
                 AND NOT (m.author_user_id IS NULL AND m.author_kind = 'human' AND m.author_name = $3)))::int AS unread,
           COALESCE((
               SELECT array_agg(DISTINCT m.body) FROM public.messages m
               WHERE m.workspace_id = r.workspace_id AND m.room = r.key
                 AND m.created_at > COALESCE(rd.last_read_at, '-infinity'::timestamptz)
                 AND m.author_user_id IS DISTINCT FROM $2
                 AND NOT (m.author_user_id IS NULL AND m.author_kind = 'human' AND m.author_name = $3)
                 AND strpos(m.body, '@') > 0), '{}'::text[]) AS unread_mention_bodies,
           last.body AS last_body, last.author_name AS last_author, last.author_user_id::text AS last_author_user_id, to_json(last.created_at) #>> '{}' AS last_at,
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
        SELECT m.body, m.author_name, m.author_user_id, m.created_at FROM public.messages m
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
        SELECT m.body, m.author_name, m.author_user_id, m.created_at FROM public.messages m
        WHERE m.workspace_id = $1 ORDER BY m.created_at DESC, m.id DESC LIMIT 1
    )
    SELECT LEAST(99, (
               SELECT count(*) FROM public.messages m
               WHERE m.workspace_id = $1
                 AND m.created_at > COALESCE((SELECT last_read_at FROM read_marker LIMIT 1), '-infinity'::timestamptz)
                 AND m.author_user_id IS DISTINCT FROM $2
                 AND NOT (m.author_user_id IS NULL AND m.author_kind = 'human' AND m.author_name = $3)))::int AS unread,
           COALESCE((
               SELECT array_agg(DISTINCT m.body) FROM public.messages m
               WHERE m.workspace_id = $1
                 AND m.created_at > COALESCE((SELECT last_read_at FROM read_marker LIMIT 1), '-infinity'::timestamptz)
                 AND m.author_user_id IS DISTINCT FROM $2
                 AND NOT (m.author_user_id IS NULL AND m.author_kind = 'human' AND m.author_name = $3)
                 AND strpos(m.body, '@') > 0), '{}'::text[]) AS unread_mention_bodies,
           (SELECT body FROM newest LIMIT 1) AS last_body,
           (SELECT author_name FROM newest LIMIT 1) AS last_author,
           (SELECT author_user_id::text FROM newest LIMIT 1) AS last_author_user_id,
           (SELECT to_json(created_at) #>> '{}' FROM newest LIMIT 1) AS last_at
    LIMIT 1`

/** Records that the caller read a room up to now ($3 the room key, '' for the Office room). */
export const MARK_ROOM_READ = sql`SELECT public.mark_office_room_read($1, $2, $3) LIMIT 1`

/**
 * The caller's unread line counts of every agent of the workspace, capped at 99 ($1 workspace, $2 the caller's user id, $3
 * their display name). An agent's conversation is its lines of the Office thread; its read marker lives in
 * office_rooms_reads under the scope key 'agent:<agent id>'.
 */
export const LIST_AGENT_UNREAD = sql`
    SELECT a.id::text AS id, LEAST(99, (
               SELECT count(*) FROM public.messages m
               WHERE m.workspace_id = a.workspace_id AND m.agent_id = a.id
                 AND m.created_at > COALESCE(rd.last_read_at, '-infinity'::timestamptz)
                 AND m.author_user_id IS DISTINCT FROM $2
                 AND NOT (m.author_user_id IS NULL AND m.author_kind = 'human' AND m.author_name = $3)))::int AS unread
    FROM public.agents a
    LEFT JOIN public.office_rooms_reads rd
           ON rd.workspace_id = a.workspace_id AND rd.user_id = $2 AND rd.room = 'agent:' || a.id::text
    WHERE a.workspace_id = $1
    ORDER BY a.id
    LIMIT 100`

/**
 * The caller's unread line counts of every lead of the workspace, capped at 99; same parameters as LIST_AGENT_UNREAD. A
 * customer's conversation is the lead's lines of the Office thread; its read marker lives under 'lead:<lead id>'.
 */
export const LIST_LEAD_UNREAD = sql`
    SELECT l.id::text AS id, LEAST(99, (
               SELECT count(*) FROM public.messages m
               WHERE m.workspace_id = l.workspace_id AND m.lead_id = l.id
                 AND m.created_at > COALESCE(rd.last_read_at, '-infinity'::timestamptz)
                 AND m.author_user_id IS DISTINCT FROM $2
                 AND NOT (m.author_user_id IS NULL AND m.author_kind = 'human' AND m.author_name = $3)))::int AS unread
    FROM public.leads l
    LEFT JOIN public.office_rooms_reads rd
           ON rd.workspace_id = l.workspace_id AND rd.user_id = $2 AND rd.room = 'lead:' || l.id::text
    WHERE l.workspace_id = $1
    ORDER BY l.id
    LIMIT 500`

/**
 * Records that the caller read an agent's conversation up to now ($3 the agent id); answers a row only when that agent
 * belongs to the workspace, so a wrong or foreign id writes no marker.
 */
export const MARK_AGENT_READ = sql`SELECT public.mark_office_room_read($1, $2, 'agent:' || $3) AS marked
WHERE EXISTS (SELECT 1 FROM public.agents WHERE workspace_id = $1 AND id::text = $3)
LIMIT 1`

/**
 * Records that the caller read a lead's conversation up to now ($3 the lead id); answers a row only when that lead
 * belongs to the workspace, so a wrong or foreign id writes no marker.
 */
export const MARK_LEAD_READ = sql`SELECT public.mark_office_room_read($1, $2, 'lead:' || $3) AS marked
WHERE EXISTS (SELECT 1 FROM public.leads WHERE workspace_id = $1 AND id::text = $3)
LIMIT 1`

/** Creates the six department rooms of a workspace and seats its active agents (idempotent). */
export const ENSURE_ROOMS = sql`SELECT public.ensure_office_rooms($1) AS opened LIMIT 1`

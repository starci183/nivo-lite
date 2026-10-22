import { sql } from "@modules/platform/database"

/** The newest line, the count and the pending approval flag of each given thread ($1 workspace, $2 thread ids). */
export const LIST_THREAD_DIGESTS = sql`SELECT m.thread_id,
       (array_agg(m.body ORDER BY m.created_at DESC, m.id DESC))[1] AS last_body,
       to_json(max(m.created_at)) #>> '{}' AS last_at,
       count(*)::int AS message_count,
       COALESCE(bool_or(m.approval ->> 'outcome' = 'pending'), false) AS waiting_approval
FROM public.thread_messages m
WHERE m.workspace_id = $1::uuid AND m.thread_id = ANY($2::uuid[])
GROUP BY m.thread_id
LIMIT 200`

/**
 * Writes a message ($1 workspace, $2 thread, $3 author kind, $4 author id, $5 text, $6 quotes JSON, $7 tags JSON, $8 approval card JSON or null,
 * $9 approval request or null).
 */
export const INSERT_MESSAGE = sql`INSERT INTO public.thread_messages
    (workspace_id, thread_id, author_kind, author_id, body, quoted, mentions, approval, approval_request_id)
VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::uuid)
RETURNING id`

/** The newest messages of a thread with the name of their author, newest first ($1 workspace, $2 thread, $3 how many). */
export const LIST_MESSAGES = sql`SELECT m.id, m.thread_id, m.workspace_id, m.author_kind, m.author_id,
       coalesce(a.name, w.display_name, '') AS author_name, coalesce(a.module, w.role, '') AS author_role,
       m.body, m.quoted, m.mentions, m.approval, to_json(m.created_at) #>> '{}' AS created_at
FROM public.thread_messages m
LEFT JOIN public.agents a ON m.author_kind = 'agent' AND a.id = m.author_id
LEFT JOIN public.workspace_members w ON m.author_kind = 'member' AND w.id = m.author_id AND w.workspace_id = m.workspace_id
WHERE m.workspace_id = $1::uuid AND m.thread_id = $2::uuid
ORDER BY m.created_at DESC, m.id DESC
LIMIT $3::int`

/** One message with the name of its author ($1 workspace, $2 message). */
export const FIND_MESSAGE = sql`SELECT m.id, m.thread_id, m.workspace_id, m.author_kind, m.author_id,
       coalesce(a.name, w.display_name, '') AS author_name, coalesce(a.module, w.role, '') AS author_role,
       m.body, m.quoted, m.mentions, m.approval, to_json(m.created_at) #>> '{}' AS created_at
FROM public.thread_messages m
LEFT JOIN public.agents a ON m.author_kind = 'agent' AND a.id = m.author_id
LEFT JOIN public.workspace_members w ON m.author_kind = 'member' AND w.id = m.author_id AND w.workspace_id = m.workspace_id
WHERE m.workspace_id = $1::uuid AND m.id = $2::uuid
LIMIT 1`

/** One message with the name of its author, locked while its approval card changes ($1 workspace, $2 message). */
export const LOCK_MESSAGE = sql`SELECT m.id, m.thread_id, m.workspace_id, m.author_kind, m.author_id,
       coalesce(a.name, w.display_name, '') AS author_name, coalesce(a.module, w.role, '') AS author_role,
       m.body, m.quoted, m.mentions, m.approval, to_json(m.created_at) #>> '{}' AS created_at
FROM public.thread_messages m
LEFT JOIN public.agents a ON m.author_kind = 'agent' AND a.id = m.author_id
LEFT JOIN public.workspace_members w ON m.author_kind = 'member' AND w.id = m.author_id AND w.workspace_id = m.workspace_id
WHERE m.workspace_id = $1::uuid AND m.id = $2::uuid
LIMIT 1
FOR UPDATE OF m`

/** The message that carries an approval request ($1 request). */
export const FIND_MESSAGE_BY_APPROVAL = sql`SELECT id, workspace_id FROM public.thread_messages WHERE approval_request_id = $1::uuid LIMIT 1`

/** Replaces the approval card of a message ($1 workspace, $2 message, $3 card JSON). */
export const UPDATE_MESSAGE_APPROVAL = sql`UPDATE public.thread_messages SET approval = $3::jsonb
WHERE workspace_id = $1::uuid AND id = $2::uuid`

/** The agent of the workspace ($1 workspace, $2 agent). */
export const FIND_AGENT = sql`SELECT id, name FROM public.agents WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1`

/** The active members among the given member ids with the room each sits in ($1 workspace, $2 member ids). */
export const FIND_MEMBER_REFS = sql`SELECT m.id, m.display_name, m.role,
       (SELECT r.key FROM public.office_rooms_members rm JOIN public.office_rooms r ON r.id = rm.room_id
        WHERE rm.user_id = m.user_id AND r.workspace_id = m.workspace_id ORDER BY r.position ASC LIMIT 1) AS room_key
FROM public.workspace_members m
WHERE m.workspace_id = $1::uuid AND m.status = 'active' AND m.id = ANY($2::uuid[])
LIMIT 20`

/** The active agents among the given ids ($1 workspace, $2 agent ids). */
export const FIND_AGENT_REFS = sql`SELECT id, name FROM public.agents
WHERE workspace_id = $1::uuid AND status = 'active' AND id = ANY($2::uuid[])
LIMIT 20`

/** The rooms among the given keys that have at least one person in them ($1 workspace, $2 room keys). */
export const FIND_ROOM_GROUPS = sql`SELECT r.key, r.name FROM public.office_rooms r
WHERE r.workspace_id = $1::uuid AND r.key = ANY($2::text[])
  AND EXISTS (SELECT 1 FROM public.office_rooms_members rm WHERE rm.room_id = r.id AND rm.user_id IS NOT NULL)
LIMIT 20`

/** Every active member of the workspace with the room each sits in, owners first ($1 workspace). */
export const LIST_DIRECTORY_MEMBERS = sql`SELECT m.id, m.display_name, m.role,
       (SELECT r.key FROM public.office_rooms_members rm JOIN public.office_rooms r ON r.id = rm.room_id
        WHERE rm.user_id = m.user_id AND r.workspace_id = m.workspace_id ORDER BY r.position ASC LIMIT 1) AS room_key
FROM public.workspace_members m
WHERE m.workspace_id = $1::uuid AND m.status = 'active'
ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, m.display_name ASC
LIMIT 200`

/** Every active agent of the workspace ($1 workspace). */
export const LIST_DIRECTORY_AGENTS = sql`SELECT id, name, module FROM public.agents
WHERE workspace_id = $1::uuid AND status = 'active'
ORDER BY name ASC
LIMIT 100`

/** The rooms of the workspace that have people in them, in their order ($1 workspace). */
export const LIST_DIRECTORY_ROOMS = sql`SELECT r.key, r.name FROM public.office_rooms r
WHERE r.workspace_id = $1::uuid
  AND EXISTS (SELECT 1 FROM public.office_rooms_members rm WHERE rm.room_id = r.id AND rm.user_id IS NOT NULL)
ORDER BY r.position ASC
LIMIT 20`

/** The display name of a member of the workspace ($1 workspace, $2 member). */
export const FIND_MEMBER_NAME = sql`SELECT display_name FROM public.workspace_members WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1`

/** The member id of a signed-in account in the workspace ($1 workspace, $2 Auth user). */
export const FIND_MEMBER_ID = sql`SELECT id FROM public.workspace_members WHERE workspace_id = $1::uuid AND user_id = $2::uuid LIMIT 1`

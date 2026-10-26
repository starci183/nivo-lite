import { sql } from "@modules/platform/database"

/** The agents of a workspace, oldest first, optionally of one module ($1 workspace, $2 module or null). */
export const LIST_AGENTS = sql`SELECT id, workspace_id, module, name, handle, role, instructions, knowledge, approval_rule, status, avatar_url, created_at
FROM public.agents
WHERE workspace_id = $1 AND ($2::text IS NULL OR module = $2)
ORDER BY created_at, id
LIMIT 200`

/** One agent of a workspace ($1 id, $2 workspace). */
export const FIND_AGENT = sql`SELECT id, workspace_id, module, name, handle, role, instructions, knowledge, approval_rule, status, avatar_url, created_at
FROM public.agents
WHERE id = $1 AND workspace_id = $2
LIMIT 1`

/** The first active agent of a department, oldest first ($1 workspace, $2 module). */
export const FIND_FIRST_ACTIVE_AGENT = sql`SELECT id, workspace_id, module, name, handle, role, instructions, knowledge, approval_rule, status, avatar_url, created_at
FROM public.agents
WHERE workspace_id = $1 AND module = $2 AND status = 'active'
ORDER BY created_at, id
LIMIT 1`

/** One active agent of a workspace ($1 id, $2 workspace). */
export const FIND_ACTIVE_AGENT = sql`SELECT id, workspace_id, module, name, handle, role, instructions, knowledge, approval_rule, status, avatar_url, created_at
FROM public.agents
WHERE id = $1 AND workspace_id = $2 AND status = 'active'
LIMIT 1`

/** Writes a new active agent and answers it ($1 workspace, $2 module, $3 name, $4 handle, $5 role, $6 instructions). */
export const INSERT_AGENT = sql`INSERT INTO public.agents (workspace_id, module, name, handle, role, instructions)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, workspace_id, module, name, handle, role, instructions, knowledge, approval_rule, status, avatar_url, created_at`

/** Renames an agent and answers its id ($1 id, $2 workspace, $3 name). */
export const RENAME_AGENT = sql`WITH changed AS (UPDATE public.agents SET name = $3 WHERE id = $1 AND workspace_id = $2 RETURNING id)
SELECT id FROM changed`

/** Sets or clears the picture of an agent and answers its id ($1 id, $2 workspace, $3 HTTPS address or null). */
export const SET_AGENT_AVATAR = sql`WITH changed AS (UPDATE public.agents SET avatar_url = $3 WHERE id = $1 AND workspace_id = $2 RETURNING id)
SELECT id FROM changed LIMIT 1`

/** Pauses or resumes an agent and answers its id ($1 id, $2 workspace, $3 active or paused). */
export const SET_AGENT_STATUS = sql`WITH changed AS (UPDATE public.agents SET status = $3 WHERE id = $1 AND workspace_id = $2 RETURNING id)
SELECT id FROM changed`

/** Replaces the free texts of an agent and answers its id ($1 id, $2 workspace, $3 instructions, $4 knowledge). */
export const SET_AGENT_TEXTS = sql`WITH changed AS (UPDATE public.agents SET instructions = $3, knowledge = $4 WHERE id = $1 AND workspace_id = $2 RETURNING id)
SELECT id FROM changed`

/** The ownership settings of one agent ($1 agent). */
export const FIND_OWNERSHIP = sql`SELECT id, workspace_id, name, status, owner_member_id, fallback_member_id, assignable_roles, assignable_rooms,
    can_tag_agent_ids::text[] AS can_tag_agent_ids
FROM public.agents
WHERE id = $1
LIMIT 1`

/** The ids among the given members that can answer today ($1 workspace, $2 member ids). */
export const LIST_ACTIVE_MEMBER_IDS = sql`SELECT m.id
FROM public.workspace_members m
WHERE m.workspace_id = $1 AND m.id = ANY($2::uuid[]) AND m.status = 'active'
LIMIT 10`

/** The first active owner of a workspace: the last person an agent's work can fall back to ($1 workspace). */
export const FIND_WORKSPACE_OWNER = sql`SELECT public.workspace_owner_member($1) AS id LIMIT 1`

/** The member row of a signed-in account in a workspace ($1 workspace, $2 user). */
export const FIND_MEMBER_ID = sql`SELECT m.id
FROM public.workspace_members m
WHERE m.workspace_id = $1 AND m.user_id = $2
LIMIT 1`

/** The given members with the first department room each sits in ($1 workspace, $2 member ids). */
export const LIST_MEMBER_STATES = sql`SELECT m.id, m.display_name, m.role, m.status,
    (SELECT r.key
     FROM public.office_rooms_members rm
     JOIN public.office_rooms r ON r.id = rm.room_id AND r.workspace_id = m.workspace_id
     WHERE rm.user_id = m.user_id
     ORDER BY r.position, r.key
     LIMIT 1) AS room_key
FROM public.workspace_members m
WHERE m.workspace_id = $1 AND m.id = ANY($2::uuid[])
LIMIT 10`

/** What deciding whether a member may hand an agent work needs ($1 agent, $2 member). */
export const FIND_ASSIGN_CONTEXT = sql`SELECT m.role, m.status AS member_status, a.status AS agent_status, a.assignable_roles, a.assignable_rooms,
    COALESCE((SELECT array_agg(r.key)
              FROM public.office_rooms_members rm
              JOIN public.office_rooms r ON r.id = rm.room_id AND r.workspace_id = m.workspace_id
              WHERE rm.user_id = m.user_id), '{}'::text[]) AS member_rooms
FROM public.agents a
JOIN public.workspace_members m ON m.workspace_id = a.workspace_id
WHERE a.id = $1 AND m.id = $2
LIMIT 1`

/** What deciding whether one agent may tag another needs ($1 tagging agent, $2 tagged agent). */
export const FIND_TAG_CONTEXT = sql`SELECT a.status AS from_status, t.status AS to_status, a.workspace_id = t.workspace_id AS same_workspace,
    t.id = ANY(a.can_tag_agent_ids) AS listed, a.id = t.id AS same_agent
FROM public.agents a
CROSS JOIN public.agents t
WHERE a.id = $1 AND t.id = $2
LIMIT 1`

/** The names of department rooms of a workspace ($1 workspace, $2 room keys). */
export const LIST_ROOM_LABELS = sql`SELECT r.key, r.name
FROM public.office_rooms r
WHERE r.workspace_id = $1 AND r.key = ANY($2::text[])
ORDER BY r.position, r.key
LIMIT 10`

/** The agents of a workspace by id, as the tag list names them ($1 workspace, $2 agent ids). */
export const LIST_TAG_TARGETS = sql`SELECT a.id, a.name, a.module, a.status
FROM public.agents a
WHERE a.workspace_id = $1 AND a.id = ANY($2::uuid[])
ORDER BY a.created_at, a.id
LIMIT 50`

/** How many of the given members are active members of the workspace ($1 workspace, $2 member ids). */
export const COUNT_ACTIVE_MEMBERS = sql`SELECT count(*)::int AS n
FROM public.workspace_members m
WHERE m.workspace_id = $1 AND m.id = ANY($2::uuid[]) AND m.status = 'active'`

/** How many of the given agents belong to the workspace ($1 workspace, $2 agent ids). */
export const COUNT_WORKSPACE_AGENTS = sql`SELECT count(*)::int AS n
FROM public.agents a
WHERE a.workspace_id = $1 AND a.id = ANY($2::uuid[])`

/** Replaces the ownership settings of an agent and answers its id ($1 id, $2 workspace, $3 owner, $4 fallback, $5 roles, $6 rooms, $7 taggable agents). */
export const SET_OWNERSHIP = sql`WITH changed AS (UPDATE public.agents
    SET owner_member_id = $3, fallback_member_id = $4, assignable_roles = $5, assignable_rooms = $6, can_tag_agent_ids = $7::uuid[]
    WHERE id = $1 AND workspace_id = $2
    RETURNING id)
SELECT id FROM changed`

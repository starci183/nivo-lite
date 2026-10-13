import { sql } from "@modules/platform/database"

/** The agents of a workspace, oldest first, optionally of one module ($1 workspace, $2 module or null). */
export const LIST_AGENTS = sql`SELECT id, workspace_id, module, name, handle, role, instructions, knowledge, approval_rule, status, created_at
FROM public.agents
WHERE workspace_id = $1 AND ($2::text IS NULL OR module = $2)
ORDER BY created_at, id
LIMIT 200`

/** One agent of a workspace ($1 id, $2 workspace). */
export const FIND_AGENT = sql`SELECT id, workspace_id, module, name, handle, role, instructions, knowledge, approval_rule, status, created_at
FROM public.agents
WHERE id = $1 AND workspace_id = $2
LIMIT 1`

/** The first active agent of a department, oldest first ($1 workspace, $2 module). */
export const FIND_FIRST_ACTIVE_AGENT = sql`SELECT id, workspace_id, module, name, handle, role, instructions, knowledge, approval_rule, status, created_at
FROM public.agents
WHERE workspace_id = $1 AND module = $2 AND status = 'active'
ORDER BY created_at, id
LIMIT 1`

/** One active agent of a workspace ($1 id, $2 workspace). */
export const FIND_ACTIVE_AGENT = sql`SELECT id, workspace_id, module, name, handle, role, instructions, knowledge, approval_rule, status, created_at
FROM public.agents
WHERE id = $1 AND workspace_id = $2 AND status = 'active'
LIMIT 1`

/** Writes a new active agent and answers it ($1 workspace, $2 module, $3 name, $4 handle, $5 role, $6 instructions). */
export const INSERT_AGENT = sql`INSERT INTO public.agents (workspace_id, module, name, handle, role, instructions)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, workspace_id, module, name, handle, role, instructions, knowledge, approval_rule, status, created_at`

/** Renames an agent and answers its id ($1 id, $2 workspace, $3 name). */
export const RENAME_AGENT = sql`WITH changed AS (UPDATE public.agents SET name = $3 WHERE id = $1 AND workspace_id = $2 RETURNING id)
SELECT id FROM changed`

/** Pauses or resumes an agent and answers its id ($1 id, $2 workspace, $3 active or paused). */
export const SET_AGENT_STATUS = sql`WITH changed AS (UPDATE public.agents SET status = $3 WHERE id = $1 AND workspace_id = $2 RETURNING id)
SELECT id FROM changed`

/** Replaces the free texts of an agent and answers its id ($1 id, $2 workspace, $3 instructions, $4 knowledge). */
export const SET_AGENT_TEXTS = sql`WITH changed AS (UPDATE public.agents SET instructions = $3, knowledge = $4 WHERE id = $1 AND workspace_id = $2 RETURNING id)
SELECT id FROM changed`

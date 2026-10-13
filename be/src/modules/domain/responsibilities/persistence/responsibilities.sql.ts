import { sql } from "@modules/platform/database"

/** Answers the oldest active Accounting agent of the workspace, if any ($1 workspace). */
export const FIND_ACCOUNTING_AGENT = sql`SELECT id, name FROM public.agents
WHERE workspace_id = $1 AND module = 'accounting' AND status = 'active'
ORDER BY created_at LIMIT 1`

/** Answers one agent of the workspace ($1 workspace, $2 agent). */
export const FIND_AGENT = sql`SELECT id, name FROM public.agents WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** Writes one open responsibility of a lead of the workspace and answers it, or answers nothing when the workspace has no such lead ($1 workspace, $2 lead, $3 title, $4 owner kind, $5 owner agent, $6 owner name, $7 next action, $8 due). */
export const INSERT_RESPONSIBILITY = sql`WITH changed AS (
    INSERT INTO public.responsibilities
        (workspace_id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action, due_at)
    SELECT $1::uuid, $2::uuid, $3::text, $4::text, $5::uuid, $6::text, $7::text, $8::timestamptz
    WHERE EXISTS (SELECT 1 FROM public.leads WHERE workspace_id = $1::uuid AND id = $2::uuid)
    RETURNING id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action, status, due_at
)
SELECT id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action, status,
    to_char(due_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS due_at
FROM changed`

/** Changes the owner, next action, due date and optionally the title of one responsibility and answers it ($1 workspace, $2 id, $3 owner kind, $4 owner agent, $5 owner name, $6 next action, $7 due, $8 title or null to keep). */
export const UPDATE_RESPONSIBILITY = sql`WITH changed AS (
    UPDATE public.responsibilities
    SET owner_kind = $3, owner_agent_id = $4, owner_name = $5, next_action = $6, due_at = $7, title = COALESCE($8, title)
    WHERE workspace_id = $1 AND id = $2
    RETURNING id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action, status, due_at
)
SELECT id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action, status,
    to_char(due_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS due_at
FROM changed`

import { sql } from "@modules/platform/database"

/** The header of one agent of a workspace with the name of its home room and the mode of the instance that drives it ($1 agent, $2 workspace). */
export const FIND_AGENT_HEAD = sql`SELECT a.id, a.name, a.handle, a.role, a.module, a.status,
    (SELECT r.name
     FROM public.office_rooms_members rm
     JOIN public.office_rooms r ON r.id = rm.room_id
     WHERE rm.agent_id = a.id AND rm.is_home
     LIMIT 1) AS room_name,
    (SELECT i.operating_mode
     FROM public.module_installations i
     WHERE i.agent_id = a.id
     ORDER BY i.created_at, i.id
     LIMIT 1) AS operating_mode
FROM public.agents a
WHERE a.id = $1 AND a.workspace_id = $2
LIMIT 1`

/**
 * The rules of the owner's authority that apply to the agents of a module, in action order ($1 workspace, $2 module). Today a rule
 * is per module (the department of its action), so it applies to every agent of that module; when rules name the agents they
 * cover, this is the one statement to change.
 */
export const LIST_APPLIED_RULES = sql`SELECT r.action, r.department, r.mode, r.limit_vnd::float8 AS limit_vnd, r.note
FROM public.authority_rules r
WHERE r.workspace_id = $1 AND r.department = $2
ORDER BY r.action
LIMIT 50`

/**
 * The latest work of a department, whatever its state, newest first ($1 workspace, $2 department, $3 limit).
 */
export const LIST_RECENT_WORK = sql`SELECT w.id, w.action, w.status, to_json(COALESCE(w.completed_at, w.updated_at)) #>> '{}' AS at,
    COALESCE(NULLIF(w.result->>'summary', ''), w.proposal->>'summary') AS summary,
    COALESCE(l.contact_name, w.proposal->'fields'->>'customer') AS customer, w.lead_id
FROM public.work_items w
LEFT JOIN public.leads l ON l.id = w.lead_id
WHERE w.workspace_id = $1 AND w.department = $2
ORDER BY COALESCE(w.completed_at, w.updated_at) DESC, w.id
LIMIT $3`

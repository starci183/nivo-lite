import { sql } from "@modules/platform/database"

/** Sets the brand of a workspace and answers its owner ($1 workspace, $2 display name, $3 logo URL). */
export const SET_WORKSPACE_BRAND = sql`WITH changed AS (
    UPDATE public.workspaces SET display_name = $2, logo_url = $3 WHERE id = $1 RETURNING owner_id
)
SELECT owner_id FROM changed`

/** Ensures an agent by its handle and answers its id ($1 workspace, $2 module, $3 name, $4 handle, $5 role, $6 instructions). */
export const UPSERT_PROFILE_AGENT = sql`INSERT INTO public.agents (workspace_id, module, name, handle, role, instructions)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (workspace_id, handle) DO UPDATE
SET module = excluded.module, name = excluded.name, role = excluded.role, instructions = excluded.instructions
RETURNING id`

/** Installs the module of an agent in setup unless an installation already drives it ($1 workspace, $2 module, $3 name, $4 agent). */
export const ENSURE_AGENT_INSTALLATION = sql`INSERT INTO public.module_installations (workspace_id, module_key, name, agent_id, status, operating_mode)
SELECT $1, $2, $3, $4, 'setup', 'assist'
WHERE NOT EXISTS (SELECT 1 FROM public.module_installations WHERE workspace_id = $1 AND agent_id = $4)`

/** The seeded document of a profile with this title ($1 workspace, $2 origin, $3 title). */
export const FIND_PROFILE_SOURCE = sql`SELECT id, content FROM public.knowledge_sources
WHERE workspace_id = $1 AND origin = $2 AND title = $3
ORDER BY created_at LIMIT 1`

/** Adds a profile document as a queued text source ($1 workspace, $2 module, $3 topic, $4 visibility, $5 title, $6 content, $7 origin, $8 owner). */
export const INSERT_PROFILE_SOURCE = sql`INSERT INTO public.knowledge_sources
    (workspace_id, module, kind, topic, tags, visibility, title, content, status, progress, origin, created_by)
VALUES ($1, $2, 'text', $3, '{}'::text[], $4, $5, $6, 'queued', 0, $7, $8)
RETURNING id`

/** Replaces the text of a profile document and queues it again ($1 id, $2 workspace, $3 content, $4 module, $5 topic, $6 visibility). */
export const REQUEUE_PROFILE_SOURCE = sql`UPDATE public.knowledge_sources
SET content = $3, module = $4, topic = $5, visibility = $6, status = 'queued', progress = 0, error = NULL, updated_at = now()
WHERE id = $1 AND workspace_id = $2`

/** Whether the Hub rooms function of the hub-rooms migration is installed. */
export const ROOMS_FUNCTION_PRESENT = sql`SELECT to_regproc('public.ensure_office_rooms') IS NOT NULL AS present`

/** Creates the department rooms of a workspace and seats its agents ($1 workspace). */
export const ENSURE_OFFICE_ROOMS = sql`SELECT public.ensure_office_rooms($1::uuid)`

/** Moves an agent's home seat to a department room unless it is already there ($1 workspace, $2 room key, $3 agent). */
export const MOVE_AGENT_HOME = sql`UPDATE public.office_room_members m
SET room_id = r.id
FROM public.office_rooms r
WHERE r.workspace_id = $1 AND r.key = $2 AND m.agent_id = $3 AND m.is_home AND m.room_id <> r.id`

/** Whether the MCP gateway grants table of the gateway migration is installed. */
export const TOOL_GRANTS_PRESENT = sql`SELECT to_regclass('public.mcp_tool_grants') IS NOT NULL AS present`

/** Grants a gateway tool to the installation an agent drives ($1 workspace, $2 agent, $3 tool, $4 mode, $5 limit VND, $6 limit %). */
export const UPSERT_TOOL_GRANT = sql`INSERT INTO public.mcp_tool_grants (workspace_id, installation_id, tool, mode, limit_vnd, limit_pct)
SELECT $1, mi.id, $3, $4, $5, $6 FROM public.module_installations mi WHERE mi.workspace_id = $1 AND mi.agent_id = $2
ON CONFLICT (installation_id, tool) DO UPDATE
SET mode = excluded.mode, limit_vnd = excluded.limit_vnd, limit_pct = excluded.limit_pct, updated_at = now()`

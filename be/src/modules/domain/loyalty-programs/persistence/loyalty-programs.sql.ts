import { sql } from "@modules/platform/database"

/** The programme of one workspace ($1 workspace). */
export const SELECT_PROGRAM = sql`SELECT workspace_id, slug, name, enabled, config, created_at
FROM public.loyalty_programs
WHERE workspace_id = $1
LIMIT 1`

/** The switched-on programme that owns a public slug ($1 slug). */
export const SELECT_PROGRAM_BY_SLUG = sql`SELECT workspace_id, slug, name, enabled, config, created_at
FROM public.loyalty_programs
WHERE slug = $1 AND enabled
LIMIT 1`

/** The name of a workspace ($1 workspace). */
export const SELECT_SHOP_NAME = sql`SELECT name
FROM public.workspaces
WHERE id = $1
LIMIT 1`

/** Whether the loyalty module is installed and not paused in a workspace ($1 workspace). */
export const SELECT_MODULE_STATUS = sql`SELECT status
FROM public.module_installations
WHERE workspace_id = $1 AND module_key = 'loyalty'
LIMIT 1`

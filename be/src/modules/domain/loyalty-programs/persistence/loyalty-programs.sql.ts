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

/** Changes only supplied fields ($1 workspace, $2 name or null, $3 enabled or null, $4 rules or null). */
export const UPDATE_PROGRAM = sql`WITH changed AS (
  UPDATE public.loyalty_programs
  SET name = COALESCE($2, name), enabled = COALESCE($3, enabled),
      config = COALESCE($4::jsonb, config), updated_at = now()
  WHERE workspace_id = $1
  RETURNING workspace_id, slug, name, enabled, config, created_at
)
SELECT * FROM changed`

/** Creates a programme unless its workspace or public slug raced ($1 workspace, $2 slug base, $3 shop name, $4 name or null, $5 enabled or null, $6 rules, $7 append a suffix). */
export const INSERT_PROGRAM = sql`INSERT INTO public.loyalty_programs (workspace_id, slug, name, enabled, config)
VALUES ($1, CASE WHEN $7::boolean THEN $2 || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8) ELSE $2 END,
        COALESCE($4, $3), COALESCE($5, true), $6::jsonb)
ON CONFLICT DO NOTHING
RETURNING workspace_id, slug, name, enabled, config, created_at`

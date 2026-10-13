import { sql } from "@modules/platform/database"

/** All pillars of a workspace ($1), in display order. */
export const SELECT_CONFIGURATION_PILLARS = sql`SELECT id, workspace_id, name, description, weight, sort, active
FROM public.content_pillars WHERE workspace_id = $1 ORDER BY sort, created_at LIMIT 100`

/** Removes pillars omitted from the replacement ($1 workspace, $2 retained ids). */
export const DELETE_CONFIGURATION_PILLARS = sql`DELETE FROM public.content_pillars
WHERE workspace_id = $1 AND NOT (id = ANY($2::uuid[]))`

/** Gives retained themes temporary unique names so swapping two names remains valid ($1 workspace, $2 retained ids). */
export const STAGE_CONFIGURATION_PILLAR_NAMES = sql`UPDATE public.content_pillars
SET name = 'edit:' || gen_random_uuid()::text WHERE workspace_id = $1 AND id = ANY($2::uuid[])`

/** Inserts or edits the manager's pillars ($1 workspace, $2 bounded rows). */
export const SAVE_CONFIGURATION_PILLARS = sql`INSERT INTO public.content_pillars (id, workspace_id, name, description, weight, active, sort)
SELECT COALESCE(r.id, gen_random_uuid()), $1, r.name, r.description, r.weight, r.active, r.sort
FROM jsonb_to_recordset($2::jsonb) AS r(id uuid, name text, description text, weight int, active boolean, sort int)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
weight = EXCLUDED.weight, active = EXCLUDED.active, sort = EXCLUDED.sort
WHERE content_pillars.workspace_id = $1`

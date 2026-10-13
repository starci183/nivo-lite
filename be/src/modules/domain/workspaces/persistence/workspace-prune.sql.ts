import { sql } from "@modules/platform/database"

/** Reads every workspace, oldest first. */
export const LIST_ALL_WORKSPACES = sql`SELECT id, name, plan_code, status FROM public.workspaces ORDER BY created_at
LIMIT 1000`

/** Deletes one workspace with everything that hangs off it ($1 id). */
export const DELETE_ONE_WORKSPACE = sql`DELETE FROM public.workspaces WHERE id = $1`

/** Counts the workspaces. */
export const COUNT_ALL_WORKSPACES = sql`SELECT (count(*))::int AS total FROM public.workspaces`

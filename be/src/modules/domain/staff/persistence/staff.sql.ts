import { sql } from "@modules/platform/database"

/** The staff of one workspace, active first, oldest first. */
export const LIST_STAFF = sql`SELECT id, workspace_id, name, role, email, active, created_at::text AS created_at
FROM public.staff WHERE workspace_id = $1::uuid ORDER BY active DESC, created_at, id LIMIT 500`

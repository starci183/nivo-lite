import { sql } from "@modules/platform/database"

/** Active staff choices, oldest first ($1 workspace, $2 limit). */
export const LIST_ACTIVE_STAFF = sql`
    SELECT id, name FROM public.staff WHERE workspace_id = $1::uuid AND active = true
    ORDER BY created_at ASC, id ASC LIMIT $2::int`

/** The names assigned to work items, including people no longer active ($1 workspace, $2 ids, $3 batch size). */
export const LIST_STAFF_NAMES = sql`
    SELECT id, name FROM public.staff WHERE workspace_id = $1::uuid AND id = ANY($2::uuid[]) LIMIT $3::int`

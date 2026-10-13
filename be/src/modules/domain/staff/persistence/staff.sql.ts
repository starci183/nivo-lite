import { sql } from "@modules/platform/database"

/** Active staff choices, oldest first ($1 workspace, $2 limit). */
export const LIST_ACTIVE_STAFF = sql`
    SELECT id, name FROM public.staff WHERE workspace_id = $1::uuid AND active = true
    ORDER BY created_at ASC, id ASC LIMIT $2::int`

/** The names assigned to work items, including people no longer active ($1 workspace, $2 ids, $3 batch size). */
export const LIST_STAFF_NAMES = sql`
    SELECT id, name FROM public.staff WHERE workspace_id = $1::uuid AND id = ANY($2::uuid[]) LIMIT $3::int`

/** The staff of one workspace, active first, oldest first. */
export const LIST_STAFF = sql`SELECT id, workspace_id, name, role, email, active, created_at::text AS created_at
FROM public.staff WHERE workspace_id = $1::uuid ORDER BY active DESC, created_at, id LIMIT 500`

/** The name of one staff row of the workspace ($1 workspace, $2 staff). */
export const FIND_STAFF_NAME = sql`
    SELECT name FROM public.staff WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1`

/** Adds a staff row ($1 workspace, $2 name, $3 role, $4 email, $5 active or null for active). */
export const INSERT_STAFF = sql`
    INSERT INTO public.staff (workspace_id, name, role, email, active)
    VALUES ($1::uuid, $2, $3, $4, COALESCE($5::boolean, true))
    RETURNING id, workspace_id, name, role, email, active, created_at::text AS created_at`

/** Replaces the name, role, email and, when given, the active flag of one staff row ($1 workspace, $2 staff, $3 name, $4 role, $5 email, $6 active or null). */
export const UPDATE_STAFF = sql`
    WITH changed AS (
        UPDATE public.staff
        SET name = $3, role = $4, email = $5, active = COALESCE($6::boolean, active)
        WHERE workspace_id = $1::uuid AND id = $2::uuid
        RETURNING id, workspace_id, name, role, email, active, created_at::text AS created_at
    )
    SELECT id, workspace_id, name, role, email, active, created_at FROM changed`

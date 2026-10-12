import { sql } from "@modules/platform/database"

/** Every membership of a person with its workspace, oldest first. */
export const LIST_MEMBERSHIPS = sql`
    SELECT m.workspace_id, m.user_id, m.role, m.staff_id, m.display_name, m.status,
           w.name AS workspace_name, w.status AS workspace_status, w.owner_id,
           w.created_at AS workspace_created_at, w.business_type
    FROM public.workspace_members m
    JOIN public.workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = $1
    ORDER BY m.created_at ASC, m.id ASC
    LIMIT 500`

/** Creates a free active workspace and answers its id; a trigger makes the creator its owner member. */
export const INSERT_FREE_WORKSPACE = sql`
    WITH created AS (
        INSERT INTO public.workspaces (owner_id, name, status)
        VALUES ($1, $2, 'active')
        RETURNING id
    )
    SELECT id FROM created LIMIT 1`

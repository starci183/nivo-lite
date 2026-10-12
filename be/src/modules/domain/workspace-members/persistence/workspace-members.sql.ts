import { sql } from "@modules/platform/database"

/** One member of one workspace by user. */
export const FIND_MEMBER = sql`
    SELECT m.workspace_id, m.user_id, m.role, m.staff_id, m.display_name, m.status
    FROM public.workspace_members m
    WHERE m.workspace_id = $1 AND m.user_id = $2
    LIMIT 1`

/** Everyone in a workspace, owners first. */
export const LIST_MEMBERS = sql`
    SELECT m.workspace_id, m.user_id, m.role, m.staff_id, m.display_name, m.status
    FROM public.workspace_members m
    WHERE m.workspace_id = $1
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, m.created_at ASC, m.id ASC
    LIMIT 500`

/** Creates or reactivates a membership; an owner is never demoted and a staff link is never dropped. */
export const UPSERT_MEMBER = sql`
    INSERT INTO public.workspace_members (workspace_id, user_id, role, staff_id, display_name)
    VALUES ($1, $2, $3, $4, coalesce((SELECT s.name FROM public.staff s WHERE s.id = $4 LIMIT 1), $5))
    ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = CASE WHEN public.workspace_members.role = 'owner' THEN 'owner' ELSE excluded.role END,
        staff_id = coalesce(excluded.staff_id, public.workspace_members.staff_id),
        status = 'active'`

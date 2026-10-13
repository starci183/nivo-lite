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

/** Changes the role of a member; the table guard refuses to demote the last active owner. */
export const UPDATE_MEMBER_ROLE = sql`
    WITH changed AS (
        UPDATE public.workspace_members SET role = $3
        WHERE workspace_id = $1 AND user_id = $2
        RETURNING user_id
    )
    SELECT user_id FROM changed LIMIT 1`

/** Enables or disables a member; the table guard refuses to disable the last active owner. */
export const UPDATE_MEMBER_STATUS = sql`
    WITH changed AS (
        UPDATE public.workspace_members SET status = $3
        WHERE workspace_id = $1 AND user_id = $2
        RETURNING user_id
    )
    SELECT user_id FROM changed LIMIT 1`

/** Removes a member from a workspace; the table guard refuses to remove the last active owner. */
export const DELETE_MEMBER = sql`
    WITH changed AS (
        DELETE FROM public.workspace_members
        WHERE workspace_id = $1 AND user_id = $2
        RETURNING user_id
    )
    SELECT user_id FROM changed LIMIT 1`

/** Saves the display name a person carries in every workspace they actively belong to. */
export const RENAME_MEMBER_EVERYWHERE = sql`
    UPDATE public.workspace_members SET display_name = $2
    WHERE user_id = $1 AND status = 'active'`

/** The active staff rows of a workspace, by name: who a member can be linked to. */
export const LIST_ACTIVE_STAFF = sql`
    SELECT s.id, s.name, s.role
    FROM public.staff s
    WHERE s.workspace_id = $1 AND s.active
    ORDER BY s.name ASC
    LIMIT 500`

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

/** Serializes the first-workspace start of one person ($1 user) until the transaction ends. */
export const LOCK_FIRST_WORKSPACE = sql`SELECT pg_advisory_xact_lock(hashtext('workspace-first:' || $1::text))`

/** Resolves an exact active owned name; two rows are enough to detect an ambiguous selector. */
export const FIND_NAMED_OWNED_WORKSPACE = sql`
    SELECT w.id, coalesce(w.status = 'active' AND m.role = 'owner' AND m.status = 'active', false) AS active
    FROM public.workspaces w
    LEFT JOIN public.workspace_members m ON m.workspace_id = w.id AND m.user_id = $1
    WHERE w.owner_id = $1 AND w.name = $2
    LIMIT 2`

/** Whether the person already owns a workspace or holds any membership, active or not ($1 user). */
export const HAS_ANY_WORKSPACE = sql`
    SELECT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.user_id = $1)
        OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.owner_id = $1) AS taken`

/** The name of one workspace ($1 workspace). */
export const FIND_WORKSPACE_NAME = sql`SELECT name FROM public.workspaces WHERE id = $1::uuid LIMIT 1`

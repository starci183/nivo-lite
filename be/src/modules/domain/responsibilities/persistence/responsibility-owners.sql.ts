import { sql } from "@modules/platform/database"

/** Answers one agent of the workspace ($1 workspace, $2 agent). */
export const FIND_OWNER_AGENT = sql`SELECT id, name FROM public.agents WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** Answers one active member of the workspace by member id ($1 workspace, $2 member). */
export const FIND_OWNER_MEMBER = sql`SELECT id, display_name FROM public.workspace_members
WHERE workspace_id = $1 AND id = $2 AND status = 'active' LIMIT 1`

/** The workspace owner seat, the default owner of a step nobody else was named for ($1 workspace). */
export const FIND_WORKSPACE_OWNER = sql`
    SELECT m.id, m.display_name
    FROM public.workspace_members m
    WHERE m.id = public.workspace_owner_member($1)
    LIMIT 1`

/** The oldest active member of the workspace with this display name, ignoring case ($1 workspace, $2 name). */
export const FIND_MEMBER_BY_NAME = sql`
    SELECT m.id, m.display_name
    FROM public.workspace_members m
    WHERE m.workspace_id = $1 AND m.status = 'active' AND lower(m.display_name) = lower($2)
    ORDER BY m.created_at ASC, m.id ASC
    LIMIT 1`

import { sql } from "@modules/platform/database"

/** Everyone of a workspace, owners first, with the department rooms they sit in ($1 workspace). */
export const LIST_DIRECTORY = sql`
    SELECT m.id AS member_id, m.display_name AS name, m.role, m.status,
           COALESCE((SELECT array_agg(r.key ORDER BY r.position, r.key)
                     FROM public.office_rooms_members rm
                     JOIN public.office_rooms r ON r.id = rm.room_id
                     WHERE rm.user_id = m.user_id AND r.workspace_id = m.workspace_id), '{}'::text[]) AS rooms
    FROM public.workspace_members m
    WHERE m.workspace_id = $1
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, m.created_at ASC, m.id ASC
    LIMIT 500`

/** The grants of one action of a workspace ($1 workspace, $2 action). */
export const LIST_ACTION_GRANTS = sql`
    SELECT g.id, g.workspace_id, g.member_id, g.action, g.unit, g.max_amount::float8 AS max_amount,
           to_json(g.updated_at) #>> '{}' AS updated_at
    FROM public.member_grants g
    WHERE g.workspace_id = $1 AND g.action = $2
    ORDER BY g.updated_at ASC, g.id ASC
    LIMIT 500`

/**
 * Creates or replaces the grant of one member for one action, counted in the unit of the workspace's rule for that action (VND when
 * the rule does not exist yet). Inserts nothing when the member is not in the workspace or the action is not in the registry
 * ($1 workspace, $2 member, $3 action, $4 maximum amount or null for no limit).
 */
export const UPSERT_GRANT = sql`
    INSERT INTO public.member_grants AS g (workspace_id, member_id, action, unit, max_amount)
    SELECT $1, m.id, a.action,
           COALESCE((SELECT r.unit FROM public.authority_rules r WHERE r.workspace_id = $1 AND r.action = a.action), 'vnd'),
           $4::numeric
    FROM public.workspace_members m
    CROSS JOIN public.authority_actions a
    WHERE m.id = $2 AND m.workspace_id = $1 AND a.action = $3
    ON CONFLICT (member_id, action) DO UPDATE SET unit = excluded.unit, max_amount = excluded.max_amount, updated_at = now()
    RETURNING g.id, g.workspace_id, g.member_id, g.action, g.unit, g.max_amount::float8 AS max_amount,
              to_json(g.updated_at) #>> '{}' AS updated_at`

/** Removes the grants of one action of a workspace that belong to none of the members named ($1 workspace, $2 action, $3 members kept). */
export const DELETE_OTHER_GRANTS = sql`
    DELETE FROM public.member_grants
    WHERE workspace_id = $1 AND action = $2 AND NOT (member_id = ANY($3::uuid[]))`

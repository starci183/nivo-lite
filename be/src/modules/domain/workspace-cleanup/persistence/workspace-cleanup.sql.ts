import { sql } from "@modules/platform/database"

/** The most workspaces one cleanup scans; a scan that reaches it is refused, never cut short. */
export const WORKSPACE_SCAN_MAX = 1000

/** The most accounts the kept workspaces may hold; a read that reaches it is refused, so no kept account is missed. */
export const KEPT_USERS_MAX = 5000

/** Every workspace by id, with the footprint of each one that is not kept ($1 the kept ids), bounded by the scan size. */
export const LIST_WORKSPACE_FOOTPRINTS = sql`SELECT w.id, w.name,
    CASE WHEN w.id = ANY($1::uuid[]) THEN NULL ELSE public.workspace_footprint(w.id) END AS footprint
FROM public.workspaces w ORDER BY w.id LIMIT 1000`

/** The accounts the kept workspaces hold ($1 the kept ids): every member and every owner, bounded by the read size. */
export const LIST_KEPT_USERS = sql`SELECT kept.user_id FROM (
    SELECT m.user_id FROM public.workspace_members m WHERE m.workspace_id = ANY($1::uuid[])
    UNION SELECT w.owner_id AS user_id FROM public.workspaces w WHERE w.id = ANY($1::uuid[])
) kept ORDER BY kept.user_id LIMIT 5000`

/** The most accounts one cleanup reads the references of: every account a bounded Auth scan can list. */
export const USER_REFERENCES_MAX = 10000

/**
 * What deleting each account ($1 the account ids) would cascade-delete or be refused by in the kept workspaces ($2) and in
 * rows of no workspace, bounded by the Auth scan size.
 */
export const LIST_USER_REFERENCES = sql`SELECT u.id AS user_id, public.workspace_user_references(u.id, $2::uuid[]) AS refs
FROM unnest($1::uuid[]) AS u(id) ORDER BY u.id LIMIT 10000`

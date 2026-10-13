import { sql } from "@modules/platform/database"

/** The oldest active owner of a workspace. */
export const FIND_WORKSPACE_OWNER = sql`SELECT user_id FROM public.workspace_members WHERE workspace_id = $1 AND role = 'owner' AND status = 'active' ORDER BY created_at LIMIT 1`

/** Every agent of a workspace with the module it works for. */
export const LIST_WORKSPACE_AGENTS = sql`SELECT id, module FROM public.agents WHERE workspace_id = $1 ORDER BY created_at`

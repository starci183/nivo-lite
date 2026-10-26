import { sql } from "@modules/platform/database"

/** The accounts that can see the chat of a workspace: its active members ($1 workspace). */
export const LIST_ACTIVE_MEMBER_IDS = sql`
    SELECT m.user_id FROM public.workspace_members m WHERE m.workspace_id = $1 AND m.status = 'active' LIMIT 500`

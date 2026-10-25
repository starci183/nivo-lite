import { sql } from "@modules/platform/database"

/** Only active people of this workspace may contribute their existing provider photo ($1 workspace, $2 requested users). */
export const READ_ROOM_MEMBER_AVATARS = sql`
    SELECT id, avatar_url FROM be_access.workspace_member_avatars($1, $2::uuid[]) ORDER BY id`

/** Writes a picture address straight to an agent row, as the table check sees it ($1 agent, $2 address). */
export const WRITE_AGENT_AVATAR = sql`UPDATE public.agents SET avatar_url = $2 WHERE id = $1`

/** Only the backend may write an agent picture; the browser roles hold no privilege on the column. */
export const AGENT_AVATAR_PRIVILEGES = sql`
    SELECT has_column_privilege('app_be', 'public.agents', 'avatar_url', 'UPDATE') AS backend,
           has_column_privilege('anon', 'public.agents', 'avatar_url', 'SELECT') AS anonymous_read,
           has_column_privilege('authenticated', 'public.agents', 'avatar_url', 'SELECT') AS browser_read,
           has_column_privilege('authenticated', 'public.agents', 'avatar_url', 'UPDATE') AS browser_write`

/** The helper is server-only; the backend cannot select the underlying private Auth table. */
export const ROOM_MEMBER_AVATAR_PRIVILEGES = sql`
    SELECT has_function_privilege('app_be', 'be_access.workspace_member_avatars(uuid,uuid[])', 'EXECUTE') AS backend,
           has_function_privilege('anon', 'be_access.workspace_member_avatars(uuid,uuid[])', 'EXECUTE') AS anonymous,
           has_function_privilege('authenticated', 'be_access.workspace_member_avatars(uuid,uuid[])', 'EXECUTE') AS browser,
           has_table_privilege('app_be', 'auth.users', 'SELECT') AS auth_table`

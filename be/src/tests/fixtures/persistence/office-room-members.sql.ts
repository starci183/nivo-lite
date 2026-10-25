import { sql } from "@modules/platform/database"

/** Only active people of this workspace may contribute their existing provider photo ($1 workspace, $2 requested users). */
export const READ_ROOM_MEMBER_AVATARS = sql`
    SELECT id, avatar_url FROM be_access.workspace_member_avatars($1, $2::uuid[]) ORDER BY id`

/** The helper is server-only; the backend cannot select the underlying private Auth table. */
export const ROOM_MEMBER_AVATAR_PRIVILEGES = sql`
    SELECT has_function_privilege('app_be', 'be_access.workspace_member_avatars(uuid,uuid[])', 'EXECUTE') AS backend,
           has_function_privilege('anon', 'be_access.workspace_member_avatars(uuid,uuid[])', 'EXECUTE') AS anonymous,
           has_function_privilege('authenticated', 'be_access.workspace_member_avatars(uuid,uuid[])', 'EXECUTE') AS browser,
           has_table_privilege('app_be', 'auth.users', 'SELECT') AS auth_table`

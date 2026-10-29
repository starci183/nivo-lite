import type { EntityManager } from "typeorm"
import { workspacesEntities } from "@modules/domain/workspaces"
import { sql } from "@modules/platform/database"

const [WorkspaceEntity] = workspacesEntities

const DELETE_AUTH_USERS = sql`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`

/** Keeps an uploaded picture on an account the way Auth stores it ($1 user, $2 address). */
const WRITE_UPLOADED_AVATAR = sql`
    UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('nivo_avatar_url', $2::text)
    WHERE id = $1`

/** Removes the Auth accounts a proof created; Auth owns no entity, so the delete is a named world statement. */
export const removeAuthUsers = async (manager: EntityManager, userIds: ReadonlyArray<string>): Promise<void> => {
    await manager.query(DELETE_AUTH_USERS, [userIds])
}

/** Removes one proof workspace; its tenant rows go with it. */
export const removeWorkspace = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    await manager.delete(WorkspaceEntity, { id: workspaceId })
}

/** Stores an uploaded picture address on an Auth account, as the Auth service does. */
export const storeUploadedAvatar = async (
    manager: EntityManager,
    userId: string,
    address: string | null,
): Promise<void> => {
    await manager.query(WRITE_UPLOADED_AVATAR, [userId, address])
}

import type { EntityManager } from "typeorm"
import { sql } from "@modules/platform/database"

/** A browser trying to place an object in the avatars bucket itself ($1 object name). The storage table is not an entity of the app. */
const BROWSER_WRITE_AVATAR = sql`INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars_public', $1)`

/** A browser trying to place an object in the avatars bucket itself. */
export const browserWriteAvatar = async (manager: EntityManager, objectName: string): Promise<void> => {
    await manager.query(BROWSER_WRITE_AVATAR, [objectName])
}

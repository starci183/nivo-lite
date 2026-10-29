import type { EntityManager } from "typeorm"
import { BROWSER_WRITE_AVATAR } from "./avatars.sql"

/** A browser trying to place an object in the avatars bucket itself. */
export const browserWriteAvatar = async (manager: EntityManager, objectName: string): Promise<void> => {
    await manager.query(BROWSER_WRITE_AVATAR, [objectName])
}

import { PlatformAdminEntity } from "./platform-admin.entity"
import { PlatformFlagEntity } from "./platform-flag.entity"

export { PlatformAdminEntity, PlatformFlagEntity }

/** Every entity the platform-admin capability owns, collected by the database connection. */
export const platformAdminEntities = [PlatformAdminEntity, PlatformFlagEntity] as const

import { PlatformAdminEntity } from "./platform-admin.entity"

export { PlatformAdminEntity }

/** Every entity the platform-admin capability owns, collected by the database connection. */
export const platformAdminEntities: readonly [typeof PlatformAdminEntity] = [PlatformAdminEntity] as const

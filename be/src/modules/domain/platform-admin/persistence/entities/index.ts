import { PlatformAdminEntity } from "./platform-admin.entity"

export { PlatformAdminEntity }

/** Every entity the platform-admin capability owns, collected by the database connection. */
export const platformAdminEntities = [PlatformAdminEntity] as const

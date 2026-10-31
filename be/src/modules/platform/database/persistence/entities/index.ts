import { HttpSecurityEntity } from "./http-security.entity"

export { HttpSecurityEntity }

/** Every entity the database capability owns. */
export const databaseEntities = [HttpSecurityEntity] as const

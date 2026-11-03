import { HttpSecurityEntity } from "./http-security.entity"

export { HttpSecurityEntity }

/** Every entity the database capability owns. */
export const databaseEntities: readonly [typeof HttpSecurityEntity] = [HttpSecurityEntity] as const

import { PublicApiEntity } from "./public-api.entity"

export { PublicApiEntity }
export type { PublicApiKind } from "./public-api.entity"

/** The entities of the public-api capability, registered on the primary connection. */
export const publicApiEntities = [PublicApiEntity] as const

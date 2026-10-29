import { AuthorityEntity } from "./authority.entity"

export { AuthorityEntity }

/** Every entity the authority capability owns, collected by the database connection. */
export const authorityEntities = [AuthorityEntity] as const

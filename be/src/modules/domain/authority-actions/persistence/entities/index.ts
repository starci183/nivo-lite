import { AuthorityActionEntity } from "./authority-action.entity"

export { AuthorityActionEntity }

/** Every entity the authority-actions capability owns, collected by the database connection. */
export const authorityActionsEntities = [AuthorityActionEntity] as const

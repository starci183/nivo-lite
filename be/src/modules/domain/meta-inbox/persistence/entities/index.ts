import { MetaInboxEntity } from "./meta-inbox.entity"

export { MetaInboxEntity }

/** The entities the meta-inbox capability owns, collected by the database module. */
export const metaInboxEntities = [MetaInboxEntity] as const

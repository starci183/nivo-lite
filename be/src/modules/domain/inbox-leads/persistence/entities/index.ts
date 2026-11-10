import { WebsiteSiteEntity } from "./website-site.entity"

export { WebsiteSiteEntity }

/** The entities the inbox-leads capability owns, collected by the database module. */
export const inboxLeadsEntities: readonly [typeof WebsiteSiteEntity] = [WebsiteSiteEntity] as const

import { WebsiteSiteEntity } from "./website-site.entity"

export { WebsiteSiteEntity }

/** The entities the website intake owns, collected by the database module. */
export const websiteIntakeEntities: readonly [typeof WebsiteSiteEntity] = [WebsiteSiteEntity] as const

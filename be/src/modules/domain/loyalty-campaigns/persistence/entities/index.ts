import { LoyaltyCampaignEntity } from "./loyalty-campaign.entity"
import { LoyaltySendEntity } from "./loyalty-send.entity"

export { LoyaltyCampaignEntity, LoyaltySendEntity }
export type { LoyaltyCampaignStatus } from "./loyalty-campaign.entity"
export type { LoyaltySendStatus } from "./loyalty-send.entity"

/** The entities the loyalty-campaigns capability owns, collected by the database module. */
export const loyaltyCampaignsEntities = [LoyaltyCampaignEntity, LoyaltySendEntity] as const

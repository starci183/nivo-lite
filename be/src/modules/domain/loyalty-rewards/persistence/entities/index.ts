import { LoyaltyRewardEntity } from "./loyalty-reward.entity"

export { LoyaltyRewardEntity }

/** The entities the loyalty-rewards capability owns, collected by the database module. */
export const loyaltyRewardsEntities: readonly [typeof LoyaltyRewardEntity] = [LoyaltyRewardEntity] as const

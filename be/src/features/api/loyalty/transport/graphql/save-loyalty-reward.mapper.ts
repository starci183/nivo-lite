import type { LoyaltyReward } from "../../application/save-loyalty-reward.contracts"
import type { LoyaltyRewardType } from "./dto/loyalty-reward.type"

export { toSaveLoyaltyRewardRequest } from "@modules/domain/loyalty"

/** Maps the application result into the GraphQL fields. */
export const toSaveLoyaltyRewardType = (result: LoyaltyReward): LoyaltyRewardType => ({ ...result })

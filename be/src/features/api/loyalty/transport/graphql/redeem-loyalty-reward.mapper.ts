import type { RedeemRewardRequest, RedeemRewardResult } from "../../application/redeem-reward.contracts"
import type { RedeemLoyaltyRewardInput } from "./dto/redeem-loyalty-reward.input"
import type { RedeemLoyaltyRewardType } from "./dto/redeem-loyalty-reward.type"

/** Maps workspace selection and bounded input into the application request. */
export const toRedeemLoyaltyRewardRequest = (
    input: RedeemLoyaltyRewardInput,
    workspaceId: string,
): RedeemRewardRequest => ({ workspaceId, ...input })

/** Maps the application result into the GraphQL fields. */
export const toRedeemLoyaltyRewardType = (result: RedeemRewardResult): RedeemLoyaltyRewardType => ({ ...result })

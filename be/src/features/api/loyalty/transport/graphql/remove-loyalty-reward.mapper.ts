import type { RewardRef, RewardDeleteResult } from "../../application/remove-loyalty-reward.contracts"
import type { RemoveLoyaltyRewardInput } from "./dto/remove-loyalty-reward.input"
import type { RemoveLoyaltyRewardType } from "./dto/remove-loyalty-reward.type"

/** Maps workspace selection and bounded input into the application request. */
export const toRemoveLoyaltyRewardRequest = (input: RemoveLoyaltyRewardInput, workspaceId: string): RewardRef => ({
    workspaceId,
    ...input,
})

/** Maps the application result into the GraphQL fields. */
export const toRemoveLoyaltyRewardType = (result: RewardDeleteResult): RemoveLoyaltyRewardType => ({ ...result })

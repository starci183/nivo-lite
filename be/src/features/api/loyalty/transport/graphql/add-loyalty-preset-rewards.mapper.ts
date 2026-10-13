import type { WorkspaceRef, RewardPresetsResult } from "../../application/add-loyalty-preset-rewards.contracts"
import type { AddLoyaltyPresetRewardsType } from "./dto/add-loyalty-preset-rewards.type"

/** Maps workspace selection into the application request. */
export const toAddLoyaltyPresetRewardsRequest = (workspaceId: string): WorkspaceRef => ({
    workspaceId,
})

/** Maps the application result into the GraphQL fields. */
export const toAddLoyaltyPresetRewardsType = (result: RewardPresetsResult): AddLoyaltyPresetRewardsType => ({
    ...result,
})

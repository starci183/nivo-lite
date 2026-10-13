import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkspaceRef, RewardPresetsResult } from "./add-loyalty-preset-rewards.contracts"

/** Requests add loyalty preset rewards for the current principal. */
export class AddLoyaltyPresetRewardsCommand extends Command<RewardPresetsResult> {
    constructor(readonly params: ExecuteParams<WorkspaceRef>) {
        super()
    }
}

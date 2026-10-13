import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RewardRef, RewardDeleteResult } from "./remove-loyalty-reward.contracts"

/** Requests remove loyalty reward for the current principal. */
export class RemoveLoyaltyRewardCommand extends Command<RewardDeleteResult> {
    constructor(readonly params: ExecuteParams<RewardRef>) {
        super()
    }
}

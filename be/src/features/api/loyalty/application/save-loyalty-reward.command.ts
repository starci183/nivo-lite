import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveRewardParams, LoyaltyReward } from "./save-loyalty-reward.contracts"

/** Requests save loyalty reward for the current principal. */
export class SaveLoyaltyRewardCommand extends Command<LoyaltyReward> {
    constructor(readonly params: ExecuteParams<SaveRewardParams>) {
        super()
    }
}

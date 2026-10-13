import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RedeemRewardRequest, RedeemRewardResult } from "./redeem-reward.contracts"

/** Redeems a reward for a customer at the counter. */
export class RedeemRewardCommand extends Command<RedeemRewardResult> {
    constructor(readonly params: ExecuteParams<RedeemRewardRequest>) {
        super()
    }
}

import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { RedeemTillRewardRequest, RedeemTillRewardResult } from "./redeem-till-reward.contracts"

/** Redeems a reward for a customer. */
export class RedeemTillRewardCommand extends Command<RedeemTillRewardResult> {
    constructor(readonly params: PublicExecuteParams<RedeemTillRewardRequest>) {
        super()
    }
}

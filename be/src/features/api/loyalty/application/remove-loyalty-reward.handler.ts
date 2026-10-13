import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltySetupService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RewardDeleteResult } from "./remove-loyalty-reward.contracts"
import { RemoveLoyaltyRewardCommand } from "./remove-loyalty-reward.command"

@CommandHandler(RemoveLoyaltyRewardCommand)
/** Delegates remove loyalty reward to the loyalty capability. */
export class RemoveLoyaltyRewardHandler extends ICQRSHandler<RemoveLoyaltyRewardCommand, RewardDeleteResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: LoyaltySetupService,
    ) {
        super(logger)
    }

    protected override process(action: RemoveLoyaltyRewardCommand): Promise<RewardDeleteResult> {
        return this.service.deleteReward(action.params.principal.id, action.params.request)
    }
}

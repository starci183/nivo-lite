import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltySetupService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { LoyaltyReward } from "./save-loyalty-reward.contracts"
import { SaveLoyaltyRewardCommand } from "./save-loyalty-reward.command"

@CommandHandler(SaveLoyaltyRewardCommand)
/** Delegates save loyalty reward to the loyalty capability. */
export class SaveLoyaltyRewardHandler extends ICQRSHandler<SaveLoyaltyRewardCommand, LoyaltyReward> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: LoyaltySetupService,
    ) {
        super(logger)
    }

    protected override process(action: SaveLoyaltyRewardCommand): Promise<LoyaltyReward> {
        return this.service.saveReward(action.params.principal.id, action.params.request)
    }
}

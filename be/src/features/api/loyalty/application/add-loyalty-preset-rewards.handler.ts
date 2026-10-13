import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltySetupService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RewardPresetsResult } from "./add-loyalty-preset-rewards.contracts"
import { AddLoyaltyPresetRewardsCommand } from "./add-loyalty-preset-rewards.command"

@CommandHandler(AddLoyaltyPresetRewardsCommand)
/** Delegates add loyalty preset rewards to the loyalty capability. */
export class AddLoyaltyPresetRewardsHandler extends ICQRSHandler<AddLoyaltyPresetRewardsCommand, RewardPresetsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: LoyaltySetupService,
    ) {
        super(logger)
    }

    protected override process(action: AddLoyaltyPresetRewardsCommand): Promise<RewardPresetsResult> {
        return this.service.addRewardPresets(action.params.principal.id, action.params.request)
    }
}

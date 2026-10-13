import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltyApiService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RedeemTillRewardResult } from "./redeem-till-reward.contracts"
import { RedeemTillRewardCommand } from "./redeem-till-reward.command"

@CommandHandler(RedeemTillRewardCommand)
/** Runs redeem-till-reward through one call of the LoyaltyApiService. */
export class RedeemTillRewardHandler extends ICQRSHandler<RedeemTillRewardCommand, RedeemTillRewardResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly tillApi: LoyaltyApiService,
    ) {
        super(logger)
    }

    protected override process(command: RedeemTillRewardCommand): Promise<RedeemTillRewardResult> {
        return this.tillApi.redeem(command.params.request)
    }
}

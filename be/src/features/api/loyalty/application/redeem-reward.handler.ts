import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltyMembersService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RedeemRewardResult } from "./redeem-reward.contracts"
import { RedeemRewardCommand } from "./redeem-reward.command"

@CommandHandler(RedeemRewardCommand)
/** Runs redeem-reward through one call of the LoyaltyMembersService. */
export class RedeemRewardHandler extends ICQRSHandler<RedeemRewardCommand, RedeemRewardResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly members: LoyaltyMembersService,
    ) {
        super(logger)
    }

    protected override process(command: RedeemRewardCommand): Promise<RedeemRewardResult> {
        return this.members.redeem(command.params.principal.id, command.params.request)
    }
}

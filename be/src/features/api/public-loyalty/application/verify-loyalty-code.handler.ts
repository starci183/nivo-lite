import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltyPublicService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { VerifyLoyaltyCodeResult } from "./verify-loyalty-code.contracts"
import { VerifyLoyaltyCodeCommand } from "./verify-loyalty-code.command"

@CommandHandler(VerifyLoyaltyCodeCommand)
/** Runs verify-loyalty-code through one call of the LoyaltyPublicService. */
export class VerifyLoyaltyCodeHandler extends ICQRSHandler<VerifyLoyaltyCodeCommand, VerifyLoyaltyCodeResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly publicCheck: LoyaltyPublicService,
    ) {
        super(logger)
    }

    protected override process(command: VerifyLoyaltyCodeCommand): Promise<VerifyLoyaltyCodeResult> {
        return this.publicCheck.verifyCode(command.params.request)
    }
}

import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltyPublicService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RequestLoyaltyCodeResult } from "./request-loyalty-code.contracts"
import { RequestLoyaltyCodeCommand } from "./request-loyalty-code.command"

@CommandHandler(RequestLoyaltyCodeCommand)
/** Runs request-loyalty-code through one call of the LoyaltyPublicService. */
export class RequestLoyaltyCodeHandler extends ICQRSHandler<RequestLoyaltyCodeCommand, RequestLoyaltyCodeResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly publicCheck: LoyaltyPublicService,
    ) {
        super(logger)
    }

    protected override process(command: RequestLoyaltyCodeCommand): Promise<RequestLoyaltyCodeResult> {
        return this.publicCheck.requestCode(command.params.request)
    }
}

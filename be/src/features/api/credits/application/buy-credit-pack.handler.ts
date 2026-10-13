import { CommandHandler } from "@nestjs/cqrs"
import type { PayableOrder } from "@modules/domain/billing"
import { CreditsService } from "@modules/domain/credits"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BuyCreditPackCommand } from "./buy-credit-pack.command"

@CommandHandler(BuyCreditPackCommand)
/** Creates the top-up order through the credits service, which admits owner and manager only. */
export class BuyCreditPackHandler extends ICQRSHandler<BuyCreditPackCommand, PayableOrder> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly credits: CreditsService,
    ) {
        super(logger)
    }

    protected override process(command: BuyCreditPackCommand): Promise<PayableOrder> {
        return this.credits.topup(command.params.principal.id, command.params.request)
    }
}

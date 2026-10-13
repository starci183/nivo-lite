import { CommandHandler } from "@nestjs/cqrs"
import { HiringOffersService } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CancelHiringOfferCommand } from "./cancel-hiring-offer.command"

@CommandHandler(CancelHiringOfferCommand)
/** Cancel an offer. */
export class CancelHiringOfferHandler extends ICQRSHandler<CancelHiringOfferCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly offers: HiringOffersService,
    ) {
        super(logger)
    }

    protected override process(command: CancelHiringOfferCommand): Promise<void> {
        return this.offers.cancel(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}

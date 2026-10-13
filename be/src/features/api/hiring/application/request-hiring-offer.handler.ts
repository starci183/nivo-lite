import { CommandHandler } from "@nestjs/cqrs"
import { HiringOffersService } from "@modules/domain/hiring"
import type { RequestOfferOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestHiringOfferCommand } from "./request-hiring-offer.command"

@CommandHandler(RequestHiringOfferCommand)
/** Draft an offer for a candidate and ask for approval. */
export class RequestHiringOfferHandler extends ICQRSHandler<RequestHiringOfferCommand, RequestOfferOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly offers: HiringOffersService,
    ) {
        super(logger)
    }

    protected override process(command: RequestHiringOfferCommand): Promise<RequestOfferOutput> {
        return this.offers.request(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}

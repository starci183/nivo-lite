import { CommandHandler } from "@nestjs/cqrs"
import { HiringOffersService } from "@modules/domain/hiring"
import type { RespondOfferOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RespondHiringOfferCommand } from "./respond-hiring-offer.command"

@CommandHandler(RespondHiringOfferCommand)
/** Accept or decline an offer from the candidate's link. */
export class RespondHiringOfferHandler extends ICQRSHandler<RespondHiringOfferCommand, RespondOfferOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly offers: HiringOffersService,
    ) {
        super(logger)
    }

    protected override process(command: RespondHiringOfferCommand): Promise<RespondOfferOutput> {
        return this.offers.respond(command.params.request, command.params.request.credentialPrincipal)
    }
}

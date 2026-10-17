import { QueryHandler } from "@nestjs/cqrs"
import { HiringOffersService } from "@modules/domain/hiring"
import type { PublicOfferOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PublicHiringOfferQuery } from "./public-hiring-offer.query"

@QueryHandler(PublicHiringOfferQuery)
/** Read an offer from the candidate's link. */
export class PublicHiringOfferHandler extends ICQRSHandler<PublicHiringOfferQuery, PublicOfferOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly offers: HiringOffersService,
    ) {
        super(logger)
    }

    protected override process(query: PublicHiringOfferQuery): Promise<PublicOfferOutput> {
        return this.offers.publicView(query.params.request, query.params.request.credentialPrincipal)
    }
}

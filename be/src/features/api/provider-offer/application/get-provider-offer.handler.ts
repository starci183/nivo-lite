import { QueryHandler } from "@nestjs/cqrs"
import { ProviderOfferService, type ProviderOffer } from "@modules/domain/provider-offer"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetProviderOfferQuery } from "./get-provider-offer.query"

@QueryHandler(GetProviderOfferQuery)
/** Asks the provider offer capability for the documentation of an account's provider; the capability proves the member. */
export class GetProviderOfferHandler extends ICQRSHandler<GetProviderOfferQuery, ProviderOffer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly offers: ProviderOfferService,
    ) {
        super(logger)
    }

    protected override process(query: GetProviderOfferQuery): Promise<ProviderOffer> {
        return this.offers.offerOf(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}

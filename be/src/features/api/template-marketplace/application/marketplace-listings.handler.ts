import { QueryHandler } from "@nestjs/cqrs"
import { TemplateCatalogueService } from "@modules/domain/template-marketplace"
import type { ListingCardView } from "@modules/domain/template-marketplace"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarketplaceListingsQuery } from "./marketplace-listings.query"

@QueryHandler(MarketplaceListingsQuery)
/** Lists the approved listings of the marketplace, for the catalogue next to the built-in modules. */
export class MarketplaceListingsHandler extends ICQRSHandler<MarketplaceListingsQuery, ReadonlyArray<ListingCardView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: TemplateCatalogueService,
    ) {
        super(logger)
    }

    protected override process(): Promise<ReadonlyArray<ListingCardView>> {
        return this.svc.catalogue()
    }
}

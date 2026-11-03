import { QueryHandler } from "@nestjs/cqrs"
import { TemplateListingsService } from "@modules/domain/template-marketplace"
import type { ListingCard } from "@modules/domain/template-marketplace"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarketplaceListingsQuery } from "./marketplace-listings.query"

@QueryHandler(MarketplaceListingsQuery)
/** Lists the approved listings of the marketplace, for the catalogue next to the built-in modules. */
export class MarketplaceListingsHandler extends ICQRSHandler<MarketplaceListingsQuery, ReadonlyArray<ListingCard>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: TemplateListingsService,
    ) {
        super(logger)
    }

    protected override process(): Promise<ReadonlyArray<ListingCard>> {
        return this.svc.catalogue()
    }
}

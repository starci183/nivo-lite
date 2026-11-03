import { Query } from "@nestjs/cqrs"
import type { ListingCard } from "@modules/domain/template-marketplace"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MarketplaceListingsRequest } from "./marketplace-listings.contracts"

/** Lists the approved listings of the marketplace, for the catalogue next to the built-in modules. */
export class MarketplaceListingsQuery extends Query<ReadonlyArray<ListingCard>> {
    constructor(readonly params: ExecuteParams<MarketplaceListingsRequest>) {
        super()
    }
}

import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { MarketplaceListingsQuery } from "../../application/marketplace-listings.query"
import { ListingCardType } from "./dto/listing-card.type"
import { toMarketplaceListingsType } from "./marketplace-listings.mapper"

@Resolver()
/** GraphQL door of marketplaceListings. */
export class MarketplaceListingsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the approved listings of the marketplace, for the catalogue next to the built-in modules. */
    @Query(() => [ListingCardType], { name: "marketplaceListings" })
    async marketplaceListings(@CurrentPrincipal() principal: Principal): Promise<Array<ListingCardType>> {
        const result = await this.queryBus.execute(new MarketplaceListingsQuery({ request: {}, principal }))
        return toMarketplaceListingsType(result)
    }
}

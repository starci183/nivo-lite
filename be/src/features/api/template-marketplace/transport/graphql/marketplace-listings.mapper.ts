import type { ListingCard } from "@modules/domain/template-marketplace"
import type { ListingCardType } from "./dto/listing-card.type"
import { toListingCardType } from "./template-marketplace.records.mapper"

/** Maps the answer to the GraphQL type. */
export const toMarketplaceListingsType = (result: ReadonlyArray<ListingCard>): Array<ListingCardType> =>
    result.map((item) => toListingCardType(item))

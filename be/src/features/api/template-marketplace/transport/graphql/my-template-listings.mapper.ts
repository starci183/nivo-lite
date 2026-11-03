import type { ListingView } from "@modules/domain/template-marketplace"
import type { ListingType } from "./dto/listing.type"
import { toListingType } from "./template-marketplace.records.mapper"

/** Maps the answer to the GraphQL type. */
export const toMyTemplateListingsType = (result: ReadonlyArray<ListingView>): Array<ListingType> =>
    result.map((item) => toListingType(item))

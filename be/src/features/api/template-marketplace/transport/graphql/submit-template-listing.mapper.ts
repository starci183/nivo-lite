import type { SubmitTemplateListingRequest } from "../../application/submit-template-listing.contracts"
import type { ListingView } from "@modules/domain/template-marketplace"
import type { SubmitTemplateListingInput } from "./dto/submit-template-listing.input"
import type { ListingType } from "./dto/listing.type"
import { toListingType } from "./template-marketplace.records.mapper"

/** Maps the GraphQL arguments of submitTemplateListing to the request. */
export const toSubmitTemplateListingRequest = (input: SubmitTemplateListingInput): SubmitTemplateListingRequest => ({
    key: input.templateKey,
    version: input.version,
    priceVnd: input.priceVnd,
})

/** Maps the answer to the GraphQL type. */
export const toSubmitTemplateListingType = (result: ListingView): ListingType => toListingType(result)

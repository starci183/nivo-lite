import type { ReviewTemplateListingRequest } from "../../application/review-template-listing.contracts"
import type { ListingView } from "@modules/domain/template-marketplace"
import type { ReviewTemplateListingInput } from "./dto/review-template-listing.input"
import type { ListingType } from "./dto/listing.type"
import { toListingType } from "./template-marketplace.records.mapper"

/** Maps the GraphQL arguments of reviewTemplateListing to the request. */
export const toReviewTemplateListingRequest = (input: ReviewTemplateListingInput): ReviewTemplateListingRequest => ({
    listingId: input.listingId,
    decision: input.decision === "approve" ? "approve" : "reject",
    note: input.note,
    revenueSharePct: input.revenueSharePct ?? null,
})

/** Maps the answer to the GraphQL type. */
export const toReviewTemplateListingType = (result: ListingView): ListingType => toListingType(result)

import { Command } from "@nestjs/cqrs"
import type { ListingView } from "@modules/domain/template-marketplace"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReviewTemplateListingRequest } from "./review-template-listing.contracts"

/** A platform reviewer approves or rejects a submitted listing. */
export class ReviewTemplateListingCommand extends Command<ListingView> {
    constructor(readonly params: ExecuteParams<ReviewTemplateListingRequest>) {
        super()
    }
}

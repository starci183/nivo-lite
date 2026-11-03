import { Command } from "@nestjs/cqrs"
import type { ListingView } from "@modules/domain/template-marketplace"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SubmitTemplateListingRequest } from "./submit-template-listing.contracts"

/** Offers a saved version of a template of the caller on the marketplace; the automated checks run at once. */
export class SubmitTemplateListingCommand extends Command<ListingView> {
    constructor(readonly params: ExecuteParams<SubmitTemplateListingRequest>) {
        super()
    }
}

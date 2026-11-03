import { CommandHandler } from "@nestjs/cqrs"
import { TemplateListingsService } from "@modules/domain/template-marketplace"
import type { ListingView } from "@modules/domain/template-marketplace"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReviewTemplateListingCommand } from "./review-template-listing.command"

@CommandHandler(ReviewTemplateListingCommand)
/** A platform reviewer approves or rejects a submitted listing. */
export class ReviewTemplateListingHandler extends ICQRSHandler<ReviewTemplateListingCommand, ListingView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: TemplateListingsService,
    ) {
        super(logger)
    }

    protected override process(command: ReviewTemplateListingCommand): Promise<ListingView> {
        const pr = command.params.principal
        const r = command.params.request
        return this.svc.review(pr, r)
    }
}

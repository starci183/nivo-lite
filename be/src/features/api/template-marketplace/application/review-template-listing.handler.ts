import { CommandHandler } from "@nestjs/cqrs"
import { TemplateListingsService, type ListingView } from "@modules/domain/template-marketplace"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
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
        return this.svc.review(command.params.principal, command.params.request)
    }
}

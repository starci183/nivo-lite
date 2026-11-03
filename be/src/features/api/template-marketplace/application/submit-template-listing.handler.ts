import { CommandHandler } from "@nestjs/cqrs"
import { TemplateListingsService } from "@modules/domain/template-marketplace"
import type { ListingView } from "@modules/domain/template-marketplace"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SubmitTemplateListingCommand } from "./submit-template-listing.command"

@CommandHandler(SubmitTemplateListingCommand)
/** Offers a saved version of a template of the caller on the marketplace; the automated checks run at once. */
export class SubmitTemplateListingHandler extends ICQRSHandler<SubmitTemplateListingCommand, ListingView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: TemplateListingsService,
    ) {
        super(logger)
    }

    protected override process(command: SubmitTemplateListingCommand): Promise<ListingView> {
        const p = command.params.principal.id
        const r = command.params.request
        return this.svc.submit(p, r)
    }
}

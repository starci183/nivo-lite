import { CommandHandler } from "@nestjs/cqrs"
import { WebsiteSitesService } from "@modules/domain/inbox-leads"
import type { WebsiteAccepted } from "@modules/domain/inbox-leads"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SubmitWebsiteLeadCommand } from "./submit-website-lead.command"

@CommandHandler(SubmitWebsiteLeadCommand)
/** Takes the visitor in through the website sites service, which judges the site key, the intake switch and the form. */
export class SubmitWebsiteLeadHandler extends ICQRSHandler<SubmitWebsiteLeadCommand, WebsiteAccepted> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sites: WebsiteSitesService,
    ) {
        super(logger)
    }

    protected override process(command: SubmitWebsiteLeadCommand): Promise<WebsiteAccepted> {
        return this.sites.submit(command.params.request.siteKey, command.params.request.submission)
    }
}

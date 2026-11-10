import { CommandHandler } from "@nestjs/cqrs"
import { WebsiteSitesService } from "@modules/domain/inbox-leads"
import type { WebsiteSiteView } from "@modules/domain/inbox-leads"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveWebsiteSiteCommand } from "./save-website-site.command"

@CommandHandler(SaveWebsiteSiteCommand)
/** Saves the website intake through the website sites service, which proves the owner or manager role. */
export class SaveWebsiteSiteHandler extends ICQRSHandler<SaveWebsiteSiteCommand, WebsiteSiteView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sites: WebsiteSitesService,
    ) {
        super(logger)
    }

    protected override process(command: SaveWebsiteSiteCommand): Promise<WebsiteSiteView> {
        return this.sites.save(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.change,
        )
    }
}

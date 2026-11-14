import { CommandHandler } from "@nestjs/cqrs"
import { ChannelFrontDoorService } from "@modules/domain/agent-instances"
import { WebsiteSitesService, type WebsiteSiteView } from "@modules/domain/inbox-leads"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SaveWebsiteSiteCommand } from "./save-website-site.command"

@CommandHandler(SaveWebsiteSiteCommand)
/**
 * Saves the website intake through the website sites service, which proves the owner or manager role; a site that is on has the agent that
 * receives its customers (a failure to install it fails the save), and that agent is written onto the site row when the row names none.
 */
export class SaveWebsiteSiteHandler extends ICQRSHandler<SaveWebsiteSiteCommand, WebsiteSiteView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sites: WebsiteSitesService,
        private readonly frontDoor: ChannelFrontDoorService,
    ) {
        super(logger)
    }

    protected override async process(command: SaveWebsiteSiteCommand): Promise<WebsiteSiteView> {
        const { workspaceId } = command.params.request
        const userId = command.params.principal.id
        const saved = await this.sites.save(userId, workspaceId, command.params.request.change)
        if (!saved.isEnabled) return saved
        const outcome = await this.frontDoor.ensureForWebsite({ principalId: userId, workspaceId })
        if (outcome.kind === "none" || outcome.agentId === null) return saved
        return this.sites.adoptFrontDoor(userId, workspaceId, outcome.agentId)
    }
}

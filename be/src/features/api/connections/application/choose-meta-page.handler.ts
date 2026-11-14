import { CommandHandler } from "@nestjs/cqrs"
import { ChannelFrontDoorService } from "@modules/domain/agent-instances"
import { MetaConnectionsService, type MetaWizardConnection } from "@modules/domain/meta-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ChooseMetaPageCommand } from "./choose-meta-page.command"

@CommandHandler(ChooseMetaPageCommand)
/**
 * Chooses the Page of a Meta connection through the MetaConnectionsService, then makes sure the channel has the agent that answers it
 * (a failure to install it fails the connect and marks the connection in error).
 */
export class ChooseMetaPageHandler extends ICQRSHandler<ChooseMetaPageCommand, MetaWizardConnection> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly meta: MetaConnectionsService,
        private readonly frontDoor: ChannelFrontDoorService,
    ) {
        super(logger)
    }

    protected override async process(command: ChooseMetaPageCommand): Promise<MetaWizardConnection> {
        const actor = { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId }
        const connected = await this.meta.choosePage(
            actor,
            command.params.request.connectionId,
            command.params.request.pageId,
        )
        const door = await this.frontDoor.ensureForConnection(actor, connected.id)
        return door.kind === "installed" || door.kind === "attached"
            ? { ...connected, agentIds: [...connected.agentIds, door.agentId] }
            : connected
    }
}

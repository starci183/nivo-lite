import { CommandHandler } from "@nestjs/cqrs"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetAgentConnectionsCommand } from "./set-agent-connections.command"

@CommandHandler(SetAgentConnectionsCommand)
/** Makes an agent use exactly these connections through the ConnectionGrantsService. */
export class SetAgentConnectionsHandler extends ICQRSHandler<SetAgentConnectionsCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly grants: ConnectionGrantsService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentConnectionsCommand): Promise<void> {
        return this.grants.setAgentConnections(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.agentId,
            command.params.request.connections,
        )
    }
}

import { CommandHandler } from "@nestjs/cqrs"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetAgentConnectionsCommand } from "./set-agent-connections.command"
import type { SetAgentConnectionsResult } from "./set-agent-connections.contracts"

@CommandHandler(SetAgentConnectionsCommand)
/** Makes exactly these connections the ones an agent uses (owner only). */
export class SetAgentConnectionsHandler extends ICQRSHandler<SetAgentConnectionsCommand, SetAgentConnectionsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly connectionGrantsService: ConnectionGrantsService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentConnectionsCommand): Promise<SetAgentConnectionsResult> {
        const { request } = command.params
        return this.connectionGrantsService.setAgentConnections(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.agentId,
            request.connections,
        )
    }
}

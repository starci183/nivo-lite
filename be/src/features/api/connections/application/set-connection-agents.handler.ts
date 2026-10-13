import { CommandHandler } from "@nestjs/cqrs"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetConnectionAgentsCommand } from "./set-connection-agents.command"

@CommandHandler(SetConnectionAgentsCommand)
/** Makes exactly these agents use a connection through the ConnectionGrantsService. */
export class SetConnectionAgentsHandler extends ICQRSHandler<SetConnectionAgentsCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly grants: ConnectionGrantsService,
    ) {
        super(logger)
    }

    protected override process(command: SetConnectionAgentsCommand): Promise<void> {
        return this.grants.setConnectionAgents(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.agents,
        )
    }
}

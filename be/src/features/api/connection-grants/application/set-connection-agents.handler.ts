import { CommandHandler } from "@nestjs/cqrs"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetConnectionAgentsCommand } from "./set-connection-agents.command"
import type { SetConnectionAgentsResult } from "./set-connection-agents.contracts"

@CommandHandler(SetConnectionAgentsCommand)
/** Makes exactly these agents the users of a connection (owner only). */
export class SetConnectionAgentsHandler extends ICQRSHandler<SetConnectionAgentsCommand, SetConnectionAgentsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly connectionGrantsService: ConnectionGrantsService,
    ) {
        super(logger)
    }

    protected override process(command: SetConnectionAgentsCommand): Promise<SetConnectionAgentsResult> {
        const { request } = command.params
        return this.connectionGrantsService.setConnectionAgents(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
            request.agents,
        )
    }
}

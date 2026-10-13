import { CommandHandler } from "@nestjs/cqrs"
import { ConnectionsService } from "@modules/domain/connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WantConnectorCommand } from "./want-connector.command"

@CommandHandler(WantConnectorCommand)
/** Records that the workspace wants a planned connector through the ConnectionsService. */
export class WantConnectorHandler extends ICQRSHandler<WantConnectorCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly connections: ConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: WantConnectorCommand): Promise<void> {
        return this.connections.wantConnector(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectorId,
        )
    }
}

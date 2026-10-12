import { CommandHandler } from "@nestjs/cqrs"
import { ConnectionsService } from "@modules/domain/connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WantConnectorCommand } from "./want-connector.command"
import type { WantConnectorResult } from "./want-connector.contracts"

@CommandHandler(WantConnectorCommand)
/** Records that the workspace wants a planned connector (manager). */
export class WantConnectorHandler extends ICQRSHandler<WantConnectorCommand, WantConnectorResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly connectionsService: ConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: WantConnectorCommand): Promise<WantConnectorResult> {
        const { request } = command.params
        return this.connectionsService.wantConnector(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectorId,
        )
    }
}

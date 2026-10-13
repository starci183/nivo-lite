import { CommandHandler } from "@nestjs/cqrs"
import { ConnectionLifecycleService } from "@modules/domain/connection-lifecycle"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DisconnectConnectionCommand } from "./disconnect-connection.command"
import type { DisconnectConnectionResult } from "./disconnect-connection.contracts"

@CommandHandler(DisconnectConnectionCommand)
/** Stops using a connection. */
export class DisconnectConnectionHandler extends ICQRSHandler<DisconnectConnectionCommand, DisconnectConnectionResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly connectionLifecycleService: ConnectionLifecycleService,
    ) {
        super(logger)
    }

    protected override process(command: DisconnectConnectionCommand): Promise<DisconnectConnectionResult> {
        const { request } = command.params
        return this.connectionLifecycleService.disconnect(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
        )
    }
}

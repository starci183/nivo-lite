import { CommandHandler } from "@nestjs/cqrs"
import { ConnectionLifecycleService } from "@modules/domain/connection-lifecycle"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeleteConnectionCommand } from "./delete-connection.command"
import type { DeleteConnectionResult } from "./delete-connection.contracts"

@CommandHandler(DeleteConnectionCommand)
/** Removes a disconnected connection. */
export class DeleteConnectionHandler extends ICQRSHandler<DeleteConnectionCommand, DeleteConnectionResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly connectionLifecycleService: ConnectionLifecycleService,
    ) {
        super(logger)
    }

    protected override process(command: DeleteConnectionCommand): Promise<DeleteConnectionResult> {
        const { request } = command.params
        return this.connectionLifecycleService.remove(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
        )
    }
}

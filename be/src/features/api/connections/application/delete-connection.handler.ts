import { CommandHandler } from "@nestjs/cqrs"
import { ConnectionLifecycleService } from "@modules/domain/connection-lifecycle"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeleteConnectionCommand } from "./delete-connection.command"

@CommandHandler(DeleteConnectionCommand)
/** Removes a disconnected connection from the list through the ConnectionLifecycleService. */
export class DeleteConnectionHandler extends ICQRSHandler<DeleteConnectionCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly lifecycle: ConnectionLifecycleService,
    ) {
        super(logger)
    }

    protected override process(command: DeleteConnectionCommand): Promise<void> {
        return this.lifecycle.remove(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
        )
    }
}

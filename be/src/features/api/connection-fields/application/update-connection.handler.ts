import { CommandHandler } from "@nestjs/cqrs"
import { ConnectionFieldsService, type ConnectionFieldsView } from "@modules/domain/connection-fields"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { UpdateConnectionCommand } from "./update-connection.command"

@CommandHandler(UpdateConnectionCommand)
/** Hands a change of an account to the connection form capability, which checks it and dispatches it to the writer of the provider. */
export class UpdateConnectionHandler extends ICQRSHandler<UpdateConnectionCommand, ConnectionFieldsView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly fields: ConnectionFieldsService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateConnectionCommand): Promise<ConnectionFieldsView> {
        return this.fields.update(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.displayName,
            command.params.request.fields,
        )
    }
}

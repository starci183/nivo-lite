import { CommandHandler } from "@nestjs/cqrs"
import { ConnectionFieldsService, type ConnectionActionResult } from "@modules/domain/connection-fields"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RunConnectionActionCommand } from "./run-connection-action.command"

@CommandHandler(RunConnectionActionCommand)
/** Hands an action run to the connection form capability, which checks it and runs it through the provider's own service. */
export class RunConnectionActionHandler extends ICQRSHandler<RunConnectionActionCommand, ConnectionActionResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly fields: ConnectionFieldsService,
    ) {
        super(logger)
    }

    protected override process(command: RunConnectionActionCommand): Promise<ConnectionActionResult> {
        return this.fields.runAction(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.action,
            command.params.request.fields,
        )
    }
}

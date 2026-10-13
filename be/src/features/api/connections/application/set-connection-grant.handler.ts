import { CommandHandler } from "@nestjs/cqrs"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetConnectionGrantCommand } from "./set-connection-grant.command"

@CommandHandler(SetConnectionGrantCommand)
/** Sets or removes the access of one agent to one connection through the ConnectionGrantsService. */
export class SetConnectionGrantHandler extends ICQRSHandler<SetConnectionGrantCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly grants: ConnectionGrantsService,
    ) {
        super(logger)
    }

    protected override process(command: SetConnectionGrantCommand): Promise<void> {
        return this.grants.setGrant(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.agentId,
            command.params.request.access,
        )
    }
}

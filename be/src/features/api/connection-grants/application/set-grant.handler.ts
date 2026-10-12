import { CommandHandler } from "@nestjs/cqrs"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetGrantCommand } from "./set-grant.command"
import type { SetGrantResult } from "./set-grant.contracts"

@CommandHandler(SetGrantCommand)
/** Gives, changes or removes one agent access to one connection (owner only). */
export class SetGrantHandler extends ICQRSHandler<SetGrantCommand, SetGrantResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly connectionGrantsService: ConnectionGrantsService,
    ) {
        super(logger)
    }

    protected override process(command: SetGrantCommand): Promise<SetGrantResult> {
        const { request } = command.params
        return this.connectionGrantsService.setGrant(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
            request.agentId,
            request.access,
        )
    }
}

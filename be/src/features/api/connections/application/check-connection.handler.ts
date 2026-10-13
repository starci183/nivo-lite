import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ConnectionCheck } from "@modules/domain/channel-connections"
import { CheckConnectionCommand } from "./check-connection.command"

@CommandHandler(CheckConnectionCommand)
/** Asks the provider what it knows about a connection through the ChannelConnectionsService. */
export class CheckConnectionHandler extends ICQRSHandler<CheckConnectionCommand, ConnectionCheck> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channels: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: CheckConnectionCommand): Promise<ConnectionCheck> {
        return this.channels.check(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
        )
    }
}

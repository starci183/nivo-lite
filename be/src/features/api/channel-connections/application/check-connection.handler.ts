import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CheckConnectionCommand } from "./check-connection.command"
import type { CheckConnectionResult } from "./check-connection.contracts"

@CommandHandler(CheckConnectionCommand)
/** Asks the provider what it knows about a connection. */
export class CheckConnectionHandler extends ICQRSHandler<CheckConnectionCommand, CheckConnectionResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channelConnectionsService: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: CheckConnectionCommand): Promise<CheckConnectionResult> {
        const { request } = command.params
        return this.channelConnectionsService.check(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
        )
    }
}

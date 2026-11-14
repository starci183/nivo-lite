import { CommandHandler } from "@nestjs/cqrs"
import { ChannelFrontDoorService } from "@modules/domain/agent-instances"
import { ChannelConnectionsService, type TelegramConnected } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ConnectTelegramCommand } from "./connect-telegram.command"

@CommandHandler(ConnectTelegramCommand)
/**
 * Connects a Telegram bot from its token through the ChannelConnectionsService, then makes sure the channel has the agent that answers
 * it (a failure to install it fails the connect and marks the connection in error).
 */
export class ConnectTelegramHandler extends ICQRSHandler<ConnectTelegramCommand, TelegramConnected> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channels: ChannelConnectionsService,
        private readonly frontDoor: ChannelFrontDoorService,
    ) {
        super(logger)
    }

    protected override async process(command: ConnectTelegramCommand): Promise<TelegramConnected> {
        const actor = { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId }
        const connected = await this.channels.connectTelegram(actor, {
            name: command.params.request.name,
            token: command.params.request.token,
        })
        await this.frontDoor.ensureForConnection(actor, connected.connection.id)
        return connected
    }
}

import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { TelegramConnected } from "@modules/domain/channel-connections"
import { ConnectTelegramCommand } from "./connect-telegram.command"

@CommandHandler(ConnectTelegramCommand)
/** Connects a Telegram bot from its token through the ChannelConnectionsService. */
export class ConnectTelegramHandler extends ICQRSHandler<ConnectTelegramCommand, TelegramConnected> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channels: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: ConnectTelegramCommand): Promise<TelegramConnected> {
        return this.channels.connectTelegram(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            { name: command.params.request.name, token: command.params.request.token },
        )
    }
}

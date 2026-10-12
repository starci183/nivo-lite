import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ConnectTelegramCommand } from "./connect-telegram.command"
import type { ConnectTelegramResult } from "./connect-telegram.contracts"

@CommandHandler(ConnectTelegramCommand)
/** Connects a Telegram bot. */
export class ConnectTelegramHandler extends ICQRSHandler<ConnectTelegramCommand, ConnectTelegramResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channelConnectionsService: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: ConnectTelegramCommand): Promise<ConnectTelegramResult> {
        const { request } = command.params
        return this.channelConnectionsService.connectTelegram(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            { name: request.name, token: request.token },
        )
    }
}

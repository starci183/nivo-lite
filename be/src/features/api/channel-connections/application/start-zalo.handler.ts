import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StartZaloCommand } from "./start-zalo.command"
import type { StartZaloResult } from "./start-zalo.contracts"

@CommandHandler(StartZaloCommand)
/** Starts a Zalo OA connection. */
export class StartZaloHandler extends ICQRSHandler<StartZaloCommand, StartZaloResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channelConnectionsService: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: StartZaloCommand): Promise<StartZaloResult> {
        const { request } = command.params
        return this.channelConnectionsService.startZaloConnection(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            { name: request.name, appId: request.appId, appSecret: request.appSecret },
        )
    }
}

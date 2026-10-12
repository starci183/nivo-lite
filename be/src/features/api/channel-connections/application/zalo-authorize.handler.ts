import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ZaloAuthorizeCommand } from "./zalo-authorize.command"
import type { ZaloAuthorizeResult } from "./zalo-authorize.contracts"

@CommandHandler(ZaloAuthorizeCommand)
/** Starts the Zalo authorization and answers the permission url. */
export class ZaloAuthorizeHandler extends ICQRSHandler<ZaloAuthorizeCommand, ZaloAuthorizeResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channelConnectionsService: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: ZaloAuthorizeCommand): Promise<ZaloAuthorizeResult> {
        const { request } = command.params
        return this.channelConnectionsService.zaloAuthorizeUrl(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
        )
    }
}

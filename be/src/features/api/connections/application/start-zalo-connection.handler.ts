import { CommandHandler } from "@nestjs/cqrs"
import { ZaloConnectService } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ZaloWizardConnection } from "@modules/domain/channel-connections"
import { StartZaloConnectionCommand } from "./start-zalo-connection.command"

@CommandHandler(StartZaloConnectionCommand)
/** Starts a Zalo OA connection from the app keys through the ZaloConnectService. */
export class StartZaloConnectionHandler extends ICQRSHandler<StartZaloConnectionCommand, ZaloWizardConnection> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly zalo: ZaloConnectService,
    ) {
        super(logger)
    }

    protected override process(command: StartZaloConnectionCommand): Promise<ZaloWizardConnection> {
        return this.zalo.start(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            {
                name: command.params.request.name,
                appId: command.params.request.appId,
                appSecret: command.params.request.appSecret,
            },
        )
    }
}

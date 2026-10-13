import { CommandHandler } from "@nestjs/cqrs"
import { ZaloConnectService } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ZaloAuthorization } from "@modules/domain/channels"
import { AuthorizeZaloCommand } from "./authorize-zalo.command"

@CommandHandler(AuthorizeZaloCommand)
/** Starts the Zalo sign-in of an OA through the ZaloConnectService. */
export class AuthorizeZaloHandler extends ICQRSHandler<AuthorizeZaloCommand, ZaloAuthorization> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly zalo: ZaloConnectService,
    ) {
        super(logger)
    }

    protected override process(command: AuthorizeZaloCommand): Promise<ZaloAuthorization> {
        return this.zalo.authorize(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
        )
    }
}

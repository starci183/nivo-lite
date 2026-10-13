import { CommandHandler } from "@nestjs/cqrs"
import { ZaloAuthorizationService } from "@modules/domain/channels"
import type { ZaloAuthorization } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BeginZaloAuthorizationCommand } from "./begin-zalo-authorization.command"

@CommandHandler(BeginZaloAuthorizationCommand)
/** Starts the Zalo authorization of a connection through the authorization service. */
export class BeginZaloAuthorizationHandler extends ICQRSHandler<BeginZaloAuthorizationCommand, ZaloAuthorization> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly authorization: ZaloAuthorizationService,
    ) {
        super(logger)
    }

    protected override process(command: BeginZaloAuthorizationCommand): Promise<ZaloAuthorization> {
        const { principal, request } = command.params
        return this.authorization.begin(principal.id, request.workspaceId, request.connectionId)
    }
}

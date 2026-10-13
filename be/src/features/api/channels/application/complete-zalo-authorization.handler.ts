import { CommandHandler } from "@nestjs/cqrs"
import { ZaloAuthorizationService } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CompleteZaloAuthorizationCommand } from "./complete-zalo-authorization.command"

@CommandHandler(CompleteZaloAuthorizationCommand)
/** Finishes the Zalo authorization of a connection through the authorization service. */
export class CompleteZaloAuthorizationHandler extends ICQRSHandler<CompleteZaloAuthorizationCommand, string> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly authorization: ZaloAuthorizationService,
    ) {
        super(logger)
    }

    protected override process(command: CompleteZaloAuthorizationCommand): Promise<string> {
        const { principal, request } = command.params
        return this.authorization.complete(principal.id, request.workspaceId, request.zaloReturn)
    }
}

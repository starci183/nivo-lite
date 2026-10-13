import { CommandHandler } from "@nestjs/cqrs"
import { ZaloConnectService } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ZaloWizardConnection } from "@modules/domain/channel-connections"
import { ReturnZaloAuthorizationCommand } from "./return-zalo-authorization.command"

@CommandHandler(ReturnZaloAuthorizationCommand)
/** Finishes the Zalo sign-in with what Zalo returned the browser with through the ZaloConnectService. */
export class ReturnZaloAuthorizationHandler extends ICQRSHandler<ReturnZaloAuthorizationCommand, ZaloWizardConnection> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly zalo: ZaloConnectService,
    ) {
        super(logger)
    }

    protected override process(command: ReturnZaloAuthorizationCommand): Promise<ZaloWizardConnection> {
        return this.zalo.finishAuthorization(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            {
                state: command.params.request.state,
                code: command.params.request.code,
                oaId: command.params.request.oaId,
            },
        )
    }
}

import { CommandHandler } from "@nestjs/cqrs"
import { AccountSessionsService } from "@modules/domain/workspace-members"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RevokeSessionCommand } from "./revoke-session.command"

@CommandHandler(RevokeSessionCommand)
/** Signs the device out through the accounts service. */
export class RevokeSessionHandler extends ICQRSHandler<RevokeSessionCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: AccountSessionsService,
    ) {
        super(logger)
    }

    protected override process(command: RevokeSessionCommand): Promise<void> {
        return this.accounts.revokeSession(
            command.params.principal.id,
            command.params.request.sessionId,
            command.params.principal.sessionId,
        )
    }
}

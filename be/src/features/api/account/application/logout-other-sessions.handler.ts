import { CommandHandler } from "@nestjs/cqrs"
import { IdentitySignInService } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LogoutOtherSessionsCommand } from "./logout-other-sessions.command"

@CommandHandler(LogoutOtherSessionsCommand)
/** Ends the other sessions of the caller. */
export class LogoutOtherSessionsHandler extends ICQRSHandler<LogoutOtherSessionsCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly signIn: IdentitySignInService,
    ) {
        super(logger)
    }

    protected override process(command: LogoutOtherSessionsCommand): Promise<void> {
        return this.signIn.endOthers(command.params.principal)
    }
}

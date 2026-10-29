import { CommandHandler } from "@nestjs/cqrs"
import { IdentitySignInService } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LogoutCommand } from "./logout.command"

@CommandHandler(LogoutCommand)
/** Revokes the session of the cookie token. */
export class LogoutHandler extends ICQRSHandler<LogoutCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly signIn: IdentitySignInService,
    ) {
        super(logger)
    }

    protected override process(command: LogoutCommand): Promise<void> {
        return this.signIn.logout(command.params.request.exchange)
    }
}

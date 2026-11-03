import { CommandHandler } from "@nestjs/cqrs"
import { IdentitySignInService } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LogoutOthersCommand } from "./logout-others.command"

@CommandHandler(LogoutOthersCommand)
/** Ends the other sessions of the caller. */
export class LogoutOthersHandler extends ICQRSHandler<LogoutOthersCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly signIn: IdentitySignInService,
    ) {
        super(logger)
    }

    protected override process(command: LogoutOthersCommand): Promise<void> {
        return this.signIn.endOthers(command.params.principal)
    }
}

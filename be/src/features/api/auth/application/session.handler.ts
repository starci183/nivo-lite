import { CommandHandler } from "@nestjs/cqrs"
import { IdentitySignInService } from "@modules/domain/identity"
import type { AccessGrant } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SessionCommand } from "./session.command"

@CommandHandler(SessionCommand)
/** Checks the cookie session without rotating it. */
export class SessionHandler extends ICQRSHandler<SessionCommand, AccessGrant> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly signIn: IdentitySignInService,
    ) {
        super(logger)
    }

    protected override process(command: SessionCommand): Promise<AccessGrant> {
        return this.signIn.session(command.params.request.exchange)
    }
}

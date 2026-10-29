import { CommandHandler } from "@nestjs/cqrs"
import { IdentitySignInService } from "@modules/domain/identity"
import type { AccessGrant } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LoginCommand } from "./login.command"

@CommandHandler(LoginCommand)
/** Signs in through the local strategy. */
export class LoginHandler extends ICQRSHandler<LoginCommand, AccessGrant> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly signIn: IdentitySignInService,
    ) {
        super(logger)
    }

    protected override process(command: LoginCommand): Promise<AccessGrant> {
        return this.signIn.login(command.params.request.exchange)
    }
}

import { CommandHandler } from "@nestjs/cqrs"
import { IdentitySignupService } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SignupCommand } from "./signup.command"

@CommandHandler(SignupCommand)
/** Signs a person up. */
export class SignupHandler extends ICQRSHandler<SignupCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly signups: IdentitySignupService,
    ) {
        super(logger)
    }

    protected override process(command: SignupCommand): Promise<void> {
        return this.signups.signup(
            command.params.request.name,
            command.params.request.email,
            command.params.request.password,
        )
    }
}

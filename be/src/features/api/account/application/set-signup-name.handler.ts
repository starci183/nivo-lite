import { CommandHandler } from "@nestjs/cqrs"
import { IdentityAccountsService } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetSignupNameCommand } from "./set-signup-name.command"

@CommandHandler(SetSignupNameCommand)
/** Keeps the sign-up name through the accounts service. */
export class SetSignupNameHandler extends ICQRSHandler<SetSignupNameCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: IdentityAccountsService,
    ) {
        super(logger)
    }

    protected override process(command: SetSignupNameCommand): Promise<void> {
        return this.accounts.setSignupName(command.params.request.email, command.params.request.name)
    }
}

import { CommandHandler } from "@nestjs/cqrs"
import { IdentitySignupService } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ConfirmCommand } from "./confirm.command"

@CommandHandler(ConfirmCommand)
/** Confirms the mailbox. */
export class ConfirmHandler extends ICQRSHandler<ConfirmCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly signups: IdentitySignupService,
    ) {
        super(logger)
    }

    protected override process(command: ConfirmCommand): Promise<void> {
        return this.signups.confirm(command.params.request.token)
    }
}

import { CommandHandler } from "@nestjs/cqrs"
import { IdentitySignupService } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ResendCommand } from "./resend.command"

@CommandHandler(ResendCommand)
/** Resends the confirmation link. */
export class ResendHandler extends ICQRSHandler<ResendCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly signups: IdentitySignupService,
    ) {
        super(logger)
    }

    protected override process(command: ResendCommand): Promise<void> {
        return this.signups.resend(command.params.request.email)
    }
}

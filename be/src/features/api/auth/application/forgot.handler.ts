import { CommandHandler } from "@nestjs/cqrs"
import { IdentityPasswordResetService } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ForgotCommand } from "./forgot.command"

@CommandHandler(ForgotCommand)
/** Requests a password link. */
export class ForgotHandler extends ICQRSHandler<ForgotCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly resets: IdentityPasswordResetService,
    ) {
        super(logger)
    }

    protected override process(command: ForgotCommand): Promise<void> {
        return this.resets.request(command.params.request.email)
    }
}

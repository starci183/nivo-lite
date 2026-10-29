import { CommandHandler } from "@nestjs/cqrs"
import { IdentityPasswordResetService } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChangePasswordCommand } from "./change-password.command"

@CommandHandler(ChangePasswordCommand)
/** Changes the password of the caller. */
export class ChangePasswordHandler extends ICQRSHandler<ChangePasswordCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly resets: IdentityPasswordResetService,
    ) {
        super(logger)
    }

    protected override process(command: ChangePasswordCommand): Promise<void> {
        return this.resets.change(command.params.principal, command.params.request.current, command.params.request.next)
    }
}

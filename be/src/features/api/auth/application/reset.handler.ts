import { CommandHandler } from "@nestjs/cqrs"
import { IdentityPasswordResetService } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ResetCommand } from "./reset.command"

@CommandHandler(ResetCommand)
/** Completes a password link. */
export class ResetHandler extends ICQRSHandler<ResetCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly resets: IdentityPasswordResetService,
    ) {
        super(logger)
    }

    protected override process(command: ResetCommand): Promise<void> {
        return this.resets.complete(command.params.request.token, command.params.request.password)
    }
}

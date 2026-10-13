import { CommandHandler } from "@nestjs/cqrs"
import { OfficeCommandService } from "@modules/domain/office-command-candidates"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CancelCommandCommand } from "./cancel-command.command"

@CommandHandler(CancelCommandCommand)
/** Cancels the card through the office command service. */
export class CancelCommandHandler extends ICQRSHandler<CancelCommandCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly commands: OfficeCommandService,
    ) {
        super(logger)
    }

    protected override process(command: CancelCommandCommand): Promise<void> {
        return this.commands.cancel(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.candidateId,
        )
    }
}

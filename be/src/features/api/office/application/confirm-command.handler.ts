import { CommandHandler } from "@nestjs/cqrs"
import { OfficeCommandService } from "@modules/domain/office-command-candidates"
import type { ConfirmResult } from "@modules/domain/office-command-candidates"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ConfirmCommandCommand } from "./confirm-command.command"

@CommandHandler(ConfirmCommandCommand)
/** Sends the card through the office command service. */
export class ConfirmCommandHandler extends ICQRSHandler<ConfirmCommandCommand, ConfirmResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly commands: OfficeCommandService,
    ) {
        super(logger)
    }

    protected override process(command: ConfirmCommandCommand): Promise<ConfirmResult> {
        return this.commands.confirm(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}

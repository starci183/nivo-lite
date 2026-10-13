import { CommandHandler } from "@nestjs/cqrs"
import { OfficeCommandService } from "@modules/domain/office-command-candidates"
import type { ProposeOutcome } from "@modules/domain/office-command-candidates"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ProposeCommandCommand } from "./propose-command.command"

@CommandHandler(ProposeCommandCommand)
/** Reads the message through the office command service. */
export class ProposeCommandHandler extends ICQRSHandler<ProposeCommandCommand, ProposeOutcome> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly commands: OfficeCommandService,
    ) {
        super(logger)
    }

    protected override process(command: ProposeCommandCommand): Promise<ProposeOutcome> {
        return this.commands.propose(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}

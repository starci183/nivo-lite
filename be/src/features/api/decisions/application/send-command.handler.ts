import { CommandHandler } from "@nestjs/cqrs"
import { WorkDecisionService } from "@modules/domain/decisions"
import type { CommandResult } from "@modules/domain/decisions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SendCommandCommand } from "./send-command.command"

@CommandHandler(SendCommandCommand)
/** Sends the command through the work decision service. */
export class SendCommandHandler extends ICQRSHandler<SendCommandCommand, CommandResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: WorkDecisionService,
    ) {
        super(logger)
    }

    protected override process(command: SendCommandCommand): Promise<CommandResult> {
        return this.decisions.sendCommand(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}

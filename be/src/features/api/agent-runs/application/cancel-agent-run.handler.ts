import { CommandHandler } from "@nestjs/cqrs"
import { AgentRunCancelService, type OwnerCancelAnswer } from "@modules/domain/agent-runs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { CancelAgentRunCommand } from "./cancel-agent-run.command"

@CommandHandler(CancelAgentRunCommand)
/** Stops a run through the owner door of the agent runs. */
export class CancelAgentRunHandler extends ICQRSHandler<CancelAgentRunCommand, OwnerCancelAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly cancels: AgentRunCancelService,
    ) {
        super(logger)
    }

    protected override process(command: CancelAgentRunCommand): Promise<OwnerCancelAnswer> {
        return this.cancels.cancel({ principalId: command.params.principal.id, ...command.params.request })
    }
}

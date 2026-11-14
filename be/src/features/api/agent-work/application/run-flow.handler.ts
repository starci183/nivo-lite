import { CommandHandler } from "@nestjs/cqrs"
import { AgentRunFlowService, type RunFlowResult } from "@modules/domain/agent-pages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RunFlowCommand } from "./run-flow.command"

@CommandHandler(RunFlowCommand)
/** `runFlow` kind `decide`: the verdict on a work item a thread approval wrote, handed to the thread approvals' one door. */
export class RunFlowHandler extends ICQRSHandler<RunFlowCommand, RunFlowResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly flow: AgentRunFlowService,
    ) {
        super(logger)
    }

    protected override process(command: RunFlowCommand): Promise<RunFlowResult> {
        return this.flow.decide(command.params.principal.id, command.params.request.workspaceId, command.params.request.flow.payload)
    }
}

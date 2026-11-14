import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkflowStartService, type WorkflowStartAnswer } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RunWorkflowCommand } from "./run-workflow.command"

@CommandHandler(RunWorkflowCommand)
/**
 * Starts one workflow of an installed agent through its `workflow.called` trigger, as the person (owner or manager: the workflows
 * door's guard), with inputs judged against the workflow's declared contract; the same opKey starts it once.
 */
export class RunWorkflowHandler extends ICQRSHandler<RunWorkflowCommand, WorkflowStartAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly starts: AgentWorkflowStartService,
    ) {
        super(logger)
    }

    protected override process(command: RunWorkflowCommand): Promise<WorkflowStartAnswer> {
        return this.starts.start(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}

import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService, type RunPinView } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentRunWorkflowsQuery } from "./agent-run-workflows.query"

@QueryHandler(AgentRunWorkflowsQuery)
/** Reads the workflow and version each of these runs of the installation's agent executes. The admin service checks the seat and that the workflow is the agent's. */
export class AgentRunWorkflowsHandler extends ICQRSHandler<AgentRunWorkflowsQuery, ReadonlyArray<RunPinView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: AgentRunWorkflowsQuery): Promise<ReadonlyArray<RunPinView>> {
        return this.admin.runPins(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}

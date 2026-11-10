import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService } from "@modules/domain/agent-graphs"
import type { WorkflowDiffWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentWorkflowDiffQuery } from "./agent-workflow-diff.query"

@QueryHandler(AgentWorkflowDiffQuery)
/** Diffs one version of a workflow against the one before it, another version or a template version. The admin service checks the seat and that the workflow is the agent's. */
export class AgentWorkflowDiffHandler extends ICQRSHandler<AgentWorkflowDiffQuery, WorkflowDiffWire> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: AgentWorkflowDiffQuery): Promise<WorkflowDiffWire> {
        return this.admin.diff(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}

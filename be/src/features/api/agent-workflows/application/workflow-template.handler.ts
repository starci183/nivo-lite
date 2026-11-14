import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService, type TemplateWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { WorkflowTemplateQuery } from "./workflow-template.query"

@QueryHandler(WorkflowTemplateQuery)
/** Reads one workflow template with its versions, what it needs and the graph of its newest version. The admin service checks the seat and that the workflow is the agent's. */
export class WorkflowTemplateHandler extends ICQRSHandler<WorkflowTemplateQuery, TemplateWire> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: WorkflowTemplateQuery): Promise<TemplateWire> {
        return this.admin.template(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}

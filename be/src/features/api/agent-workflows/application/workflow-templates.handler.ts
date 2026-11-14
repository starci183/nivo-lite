import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService, type TemplateWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { WorkflowTemplatesQuery } from "./workflow-templates.query"

@QueryHandler(WorkflowTemplatesQuery)
/** Lists the workflow templates of the market, of one module or of all. The admin service checks the seat and that the workflow is the agent's. */
export class WorkflowTemplatesHandler extends ICQRSHandler<WorkflowTemplatesQuery, ReadonlyArray<TemplateWire>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: WorkflowTemplatesQuery): Promise<ReadonlyArray<TemplateWire>> {
        return this.admin.templates(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}

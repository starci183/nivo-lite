import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService, type TemplatePreviewWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentWorkflowTemplatePreviewQuery } from "./agent-workflow-template-preview.query"

@QueryHandler(AgentWorkflowTemplatePreviewQuery)
/** Shows what accepting a newer template version would write into a workflow; nothing is written. The admin service checks the seat and that the workflow is the agent's. */
export class AgentWorkflowTemplatePreviewHandler extends ICQRSHandler<
    AgentWorkflowTemplatePreviewQuery,
    TemplatePreviewWire
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: AgentWorkflowTemplatePreviewQuery): Promise<TemplatePreviewWire> {
        return this.admin.templatePreview(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}

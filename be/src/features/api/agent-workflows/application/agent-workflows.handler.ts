import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkflowListService, type WorkflowListWire } from "@modules/domain/agent-pages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentWorkflowsQuery } from "./agent-workflows.query"

@QueryHandler(AgentWorkflowsQuery)
/** Lists the workflows of the agent of one installation, the primary one first adopted from its graph, each with its readiness. */
export class AgentWorkflowsHandler extends ICQRSHandler<AgentWorkflowsQuery, ReadonlyArray<WorkflowListWire>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workflows: AgentWorkflowListService,
    ) {
        super(logger)
    }

    protected override process(query: AgentWorkflowsQuery): Promise<ReadonlyArray<WorkflowListWire>> {
        return this.workflows.list(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.installationId,
            query.params.request.locale,
        )
    }
}

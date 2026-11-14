import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkflowStartService, type WorkflowStartView } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RunnableWorkflowQuery } from "./runnable-workflow.query"

@QueryHandler(RunnableWorkflowQuery)
/** Reads whether a person may start one workflow and its input's JSON Schema (owner or manager: the workflows door's guard). */
export class RunnableWorkflowHandler extends ICQRSHandler<RunnableWorkflowQuery, WorkflowStartView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly starts: AgentWorkflowStartService,
    ) {
        super(logger)
    }

    protected override process(query: RunnableWorkflowQuery): Promise<WorkflowStartView> {
        return this.starts.runnable(
            { workspaceId: query.params.request.workspaceId, principalId: query.params.principal.id },
            query.params.request,
        )
    }
}

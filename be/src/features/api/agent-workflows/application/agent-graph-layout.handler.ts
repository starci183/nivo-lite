import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { AgentGraphLayoutResult } from "./agent-graph-layout.contracts"
import { AgentGraphLayoutQuery } from "./agent-graph-layout.query"

@QueryHandler(AgentGraphLayoutQuery)
/** Where the owner placed each workflow on the Graph page of one installation. The admin service checks the seat. */
export class AgentGraphLayoutHandler extends ICQRSHandler<AgentGraphLayoutQuery, AgentGraphLayoutResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: AgentGraphLayoutQuery): Promise<AgentGraphLayoutResult> {
        return this.admin.layout(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}

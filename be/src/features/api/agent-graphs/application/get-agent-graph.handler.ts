import { QueryHandler } from "@nestjs/cqrs"
import { AgentGraphAdminService } from "@modules/domain/agent-graphs"
import type { AgentGraphWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetAgentGraphQuery } from "./get-agent-graph.query"

@QueryHandler(GetAgentGraphQuery)
/** Opens the graph of one agent for the editor, seeding it on the first open. The admin service checks the owner or manager role. */
export class GetAgentGraphHandler extends ICQRSHandler<GetAgentGraphQuery, AgentGraphWire> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentGraphAdminService,
    ) {
        super(logger)
    }

    protected override process(command: GetAgentGraphQuery): Promise<AgentGraphWire> {
        return this.admin.open(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request.agentId,
            command.params.request.locale,
        )
    }
}

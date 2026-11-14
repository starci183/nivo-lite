import { QueryHandler } from "@nestjs/cqrs"
import { AgentGraphReadService, type AgentGraphRead } from "@modules/domain/agent-pages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetAgentGraphQuery } from "./get-agent-graph.query"

@QueryHandler(GetAgentGraphQuery)
/** Opens the graph of one agent for the editor, with the model and the credits of each AI node over the last 7 days. */
export class GetAgentGraphHandler extends ICQRSHandler<GetAgentGraphQuery, AgentGraphRead> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly graphs: AgentGraphReadService,
    ) {
        super(logger)
    }

    protected override process(query: GetAgentGraphQuery): Promise<AgentGraphRead> {
        return this.graphs.open(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.agentId,
            query.params.request.locale,
        )
    }
}

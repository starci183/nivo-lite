import { QueryHandler } from "@nestjs/cqrs"
import { AgentLensesService } from "@modules/domain/agents"
import type { AgentKnowledgeOverview } from "@modules/domain/agents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetAgentKnowledgeQuery } from "./get-agent-knowledge.query"

@QueryHandler(GetAgentKnowledgeQuery)
/** Reads what one agent reads of the shared knowledge, through the same view the agent answers by. */
export class GetAgentKnowledgeHandler extends ICQRSHandler<GetAgentKnowledgeQuery, AgentKnowledgeOverview> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly lenses: AgentLensesService,
    ) {
        super(logger)
    }

    protected override process(query: GetAgentKnowledgeQuery): Promise<AgentKnowledgeOverview> {
        return this.lenses.overview(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.agentId,
        )
    }
}

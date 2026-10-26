import { QueryHandler } from "@nestjs/cqrs"
import { AgentLensesService } from "@modules/domain/agents"
import type { AgentKnowledgeLens } from "@modules/domain/agents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentKnowledgeLensesQuery } from "./agent-knowledge-lenses.query"

@QueryHandler(AgentKnowledgeLensesQuery)
/** Reads what the customer and every active agent may read of the shared knowledge. */
export class AgentKnowledgeLensesHandler extends ICQRSHandler<
    AgentKnowledgeLensesQuery,
    ReadonlyArray<AgentKnowledgeLens>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly lenses: AgentLensesService,
    ) {
        super(logger)
    }

    protected override process(query: AgentKnowledgeLensesQuery): Promise<ReadonlyArray<AgentKnowledgeLens>> {
        return this.lenses.list(query.params.principal.id, query.params.request.workspaceId)
    }
}

import { QueryHandler } from "@nestjs/cqrs"
import { AgentCatalogService } from "@modules/domain/agents"
import type { CatalogAgent } from "@modules/domain/agents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListAgentCatalogQuery } from "./list-agent-catalog.query"

@QueryHandler(ListAgentCatalogQuery)
/** Answers the catalog entries of the workspace from the agent catalog service. */
export class ListAgentCatalogHandler extends ICQRSHandler<ListAgentCatalogQuery, ReadonlyArray<CatalogAgent>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly catalog: AgentCatalogService,
    ) {
        super(logger)
    }

    protected override process(query: ListAgentCatalogQuery): Promise<ReadonlyArray<CatalogAgent>> {
        return this.catalog.list(query.params.principal.id, query.params.request.workspaceId)
    }
}

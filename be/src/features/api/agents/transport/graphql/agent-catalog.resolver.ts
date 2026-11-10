import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListAgentCatalogQuery } from "../../application/list-agent-catalog.query"
import { toAgentCatalogType, toListAgentCatalogRequest } from "./agent-catalog.mapper"
import { AgentCatalogEntryType } from "./dto/agent-catalog-entry.type"

@Resolver()
/** GraphQL door of the agent catalog: every agent with its granted connections and knowledge counts, in one read. */
export class AgentCatalogResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the agents of the workspace with the connections granted to each and what each reads; any member may look. */
    @Query(() => [AgentCatalogEntryType], { name: "agentCatalog" })
    async agentCatalog(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<AgentCatalogEntryType>> {
        const result = await this.queryBus.execute(
            new ListAgentCatalogQuery({ request: toListAgentCatalogRequest(workspaceId), principal }),
        )
        return toAgentCatalogType(result)
    }
}

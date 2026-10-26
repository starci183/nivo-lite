import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AgentKnowledgeLensesQuery } from "../../application/agent-knowledge-lenses.query"
import { AgentKnowledgeLensType } from "./dto/agent-knowledge-lens.type"
import { toAgentKnowledgeLensesRequest, toAgentKnowledgeLensesType } from "./agent-knowledge-lenses.mapper"

@Resolver()
/** GraphQL door of what the customer and every active agent may read of the shared knowledge. */
export class AgentKnowledgeLensesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** What the customer and every active agent may read of the shared knowledge. */
    @Query(() => [AgentKnowledgeLensType], { name: "agentKnowledgeLenses" })
    async agentKnowledgeLenses(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<AgentKnowledgeLensType>> {
        const result = await this.queryBus.execute(
            new AgentKnowledgeLensesQuery({ request: toAgentKnowledgeLensesRequest(workspaceId), principal }),
        )
        return toAgentKnowledgeLensesType(result)
    }
}

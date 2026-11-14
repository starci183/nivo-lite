import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetAgentKnowledgeQuery } from "../../application/get-agent-knowledge.query"
import { AgentIdInput } from "./dto/agent-id.input"
import { AgentKnowledgeType } from "./dto/agent-knowledge.type"
import { toAgentKnowledgeRequest, toAgentKnowledgeType } from "./agent-knowledge.mapper"

@Resolver()
/** GraphQL door of what one agent reads of the shared knowledge. */
export class AgentKnowledgeResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the layers, documents, waiting facts and own facts of one agent. */
    @Query(() => AgentKnowledgeType, { name: "agentKnowledge" })
    async agentKnowledge(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentIdInput,
    ): Promise<AgentKnowledgeType> {
        const result = await this.queryBus.execute(
            new GetAgentKnowledgeQuery({ request: toAgentKnowledgeRequest(workspaceId, input), principal }),
        )
        return toAgentKnowledgeType(result)
    }
}

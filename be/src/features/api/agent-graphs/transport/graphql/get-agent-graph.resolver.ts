import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetAgentGraphQuery } from "../../application/get-agent-graph.query"
import { AgentGraphType } from "./dto/agent-graph.type"
import { GetAgentGraphInput } from "./dto/get-agent-graph.input"

@Resolver()
/** GraphQL door of getAgentGraph. */
export class GetAgentGraphResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The getAgentGraph query. */
    @Query(() => AgentGraphType, { name: "getAgentGraph" })
    getAgentGraph(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetAgentGraphInput,
    ): Promise<AgentGraphType> {
        return this.queryBus.execute(
            new GetAgentGraphQuery({
                request: { workspaceId, agentId: input.agentId, locale: input.locale },
                principal,
            }),
        )
    }
}

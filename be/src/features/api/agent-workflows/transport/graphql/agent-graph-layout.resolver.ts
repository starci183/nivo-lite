import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { AgentGraphLayoutQuery } from "../../application/agent-graph-layout.query"
import { AgentGraphLayoutType } from "./dto/agent-graph-layout.type"
import { AgentGraphLayoutInput } from "./dto/agent-graph-layout.input"

@Resolver()
/** GraphQL door of agentGraphLayout. */
export class AgentGraphLayoutResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The agentGraphLayout query. */
    @Query(() => AgentGraphLayoutType, { name: "agentGraphLayout" })
    agentGraphLayout(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentGraphLayoutInput,
    ): Promise<AgentGraphLayoutType> {
        return this.queryBus.execute(new AgentGraphLayoutQuery({ request: { workspaceId, ...input }, principal }))
    }
}

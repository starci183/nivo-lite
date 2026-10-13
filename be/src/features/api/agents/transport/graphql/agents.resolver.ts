import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListAgentsQuery } from "../../application/list-agents.query"
import { AgentSummaryType } from "./dto/agent-summary.type"
import { ListAgentsInput } from "./dto/list-agents.input"
import { toAgentsType, toListAgentsRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door of the agent list. */
export class AgentsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the agents of the workspace, oldest first, optionally of one module. */
    @Query(() => [AgentSummaryType], { name: "agents" })
    async agents(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ListAgentsInput,
    ): Promise<Array<AgentSummaryType>> {
        const result = await this.queryBus.execute(
            new ListAgentsQuery({ request: toListAgentsRequest(workspaceId, input), principal }),
        )
        return toAgentsType(result)
    }
}

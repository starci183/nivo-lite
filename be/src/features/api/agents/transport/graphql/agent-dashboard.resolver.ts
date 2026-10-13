import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetAgentDashboardQuery } from "../../application/get-agent-dashboard.query"
import { AgentDashboardType } from "./dto/agent-dashboard.type"
import { AgentDashboardInput } from "./dto/agent-dashboard.input"
import { toAgentDashboardType, toDashboardRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door of the dashboard of one module agent. */
export class AgentDashboardResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the regions of the dashboard; a region that fails is reported in place and never fails the page. */
    @Query(() => AgentDashboardType, { name: "agentDashboard" })
    async agentDashboard(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentDashboardInput,
    ): Promise<AgentDashboardType> {
        const result = await this.queryBus.execute(
            new GetAgentDashboardQuery({ request: toDashboardRequest(workspaceId, input), principal }),
        )
        return toAgentDashboardType(result)
    }
}

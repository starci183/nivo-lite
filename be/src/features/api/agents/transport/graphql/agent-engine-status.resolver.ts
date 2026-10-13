import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetEngineStatusQuery } from "../../application/get-engine-status.query"
import { AgentEngineStatusType } from "./dto/agent-engine-status.type"
import { toAgentEngineStatusType, toWorkspaceRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door of the agent engine status. */
export class AgentEngineStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Whether the agent engine can answer now; any member may look. */
    @Query(() => AgentEngineStatusType, { name: "agentEngineStatus" })
    async agentEngineStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<AgentEngineStatusType> {
        const result = await this.queryBus.execute(
            new GetEngineStatusQuery({ request: toWorkspaceRequest(workspaceId), principal }),
        )
        return toAgentEngineStatusType(result)
    }
}

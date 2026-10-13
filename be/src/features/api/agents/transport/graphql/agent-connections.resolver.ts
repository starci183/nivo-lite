import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListAgentConnectionsQuery } from "../../application/list-agent-connections.query"
import { AgentConnectionType } from "./dto/agent-connection.type"
import { AgentIdInput } from "./dto/agent-id.input"
import { toAgentConnectionsType, toListAgentConnectionsRequest } from "./agents.mapper"

@Resolver()
/** GraphQL door of the connections granted to one agent. */
export class AgentConnectionsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the connections granted to the agent, whatever the purpose; any member may look. */
    @Query(() => [AgentConnectionType], { name: "agentConnections" })
    async agentConnections(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentIdInput,
    ): Promise<Array<AgentConnectionType>> {
        const result = await this.queryBus.execute(
            new ListAgentConnectionsQuery({ request: toListAgentConnectionsRequest(workspaceId, input), principal }),
        )
        return toAgentConnectionsType(result)
    }
}

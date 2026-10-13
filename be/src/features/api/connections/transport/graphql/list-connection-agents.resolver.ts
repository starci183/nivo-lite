import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListConnectionAgentsQuery } from "../../application/list-connection-agents.query"
import { ConnectionAgentType } from "./dto/connection-agent.type"
import { toListConnectionAgentsRequest, toListConnectionAgentsType } from "./list-connection-agents.mapper"

@Resolver()
/** GraphQL door of connectionAgents. */
export class ListConnectionAgentsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks for the agents a connection can be attached to. */
    @Query(() => [ConnectionAgentType], { name: "connectionAgents" })
    async connectionAgents(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<ConnectionAgentType>> {
        const result = await this.queryBus.execute(
            new ListConnectionAgentsQuery({ request: toListConnectionAgentsRequest(workspaceId), principal }),
        )
        return toListConnectionAgentsType(result)
    }
}

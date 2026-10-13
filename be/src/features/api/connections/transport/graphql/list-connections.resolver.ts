import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListConnectionsQuery } from "../../application/list-connections.query"
import { ConnectionType } from "./dto/connection.type"
import { toListConnectionsRequest, toListConnectionsType } from "./list-connections.mapper"

@Resolver()
/** GraphQL door of connections. */
export class ListConnectionsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks for every connection of the workspace with the agents that use each. */
    @Query(() => [ConnectionType], { name: "connections" })
    async connections(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<ConnectionType>> {
        const result = await this.queryBus.execute(
            new ListConnectionsQuery({ request: toListConnectionsRequest(workspaceId), principal }),
        )
        return toListConnectionsType(result)
    }
}

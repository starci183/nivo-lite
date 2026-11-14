import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { ListConnectionGrantsQuery } from "../../application/list-connection-grants.query"
import { ConnectionAgentGrantType } from "./dto/connection-agent-grant.type"
import { toConnectionGrantsType } from "./agents.mapper"

@Resolver()
/** GraphQL door of the reverse view: which agents are granted each connection of the workspace. */
export class ConnectionGrantsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists every grant of the workspace beside its agent, for the provider pages; any member may look. */
    @Query(() => [ConnectionAgentGrantType], { name: "connectionAgentGrants" })
    async connectionAgentGrants(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<ConnectionAgentGrantType>> {
        const result = await this.queryBus.execute(
            new ListConnectionGrantsQuery({ request: { workspaceId }, principal }),
        )
        return toConnectionGrantsType(result)
    }
}

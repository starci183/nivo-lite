import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListMcpToolGrantsQuery } from "../../application/list-mcp-tool-grants.query"
import { McpToolGrantType } from "./dto/mcp-tool-grant.type"
import { toMcpToolGrantTypes } from "./mcp-gateway.mapper"

@Resolver()
/** GraphQL door of mcpToolGrants. */
export class ListMcpToolGrantsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Every agent's tool grants. */
    @Query(() => [McpToolGrantType], { name: "mcpToolGrants" })
    async mcpToolGrants(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<McpToolGrantType>> {
        const result = await this.queryBus.execute(new ListMcpToolGrantsQuery({ request: { workspaceId }, principal }))
        return toMcpToolGrantTypes(result)
    }
}

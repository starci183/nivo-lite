import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListMcpConnectorsQuery } from "../../application/list-mcp-connectors.query"
import { McpConnectorType } from "./dto/mcp-connector.type"
import { toMcpConnectorTypes } from "./mcp-gateway.mapper"

@Resolver()
/** GraphQL door of mcpConnectors. */
export class ListMcpConnectorsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The gateway connectors of the workspace with their tools. */
    @Query(() => [McpConnectorType], { name: "mcpConnectors" })
    async mcpConnectors(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<McpConnectorType>> {
        const result = await this.queryBus.execute(new ListMcpConnectorsQuery({ request: { workspaceId }, principal }))
        return toMcpConnectorTypes(result)
    }
}

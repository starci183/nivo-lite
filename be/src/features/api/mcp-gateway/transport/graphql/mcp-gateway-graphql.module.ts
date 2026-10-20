import { Module } from "@nestjs/common"
import { McpGatewayApiModule } from "../../mcp-gateway.module"
import { ConfigurableModuleClass } from "./mcp-gateway-graphql.module-definition"
import { ListMcpConnectorsResolver } from "./list-mcp-connectors.resolver"
import { ListMcpToolGrantsResolver } from "./list-mcp-tool-grants.resolver"
import { ListMcpCallLogResolver } from "./list-mcp-call-log.resolver"
import { SetMcpToolGrantResolver } from "./set-mcp-tool-grant.resolver"
import { RegisterMcpConnectorResolver } from "./register-mcp-connector.resolver"
import { SyncMcpConnectorResolver } from "./sync-mcp-connector.resolver"

@Module({
    imports: [McpGatewayApiModule.register({})],
    providers: [
        ListMcpConnectorsResolver,
        ListMcpToolGrantsResolver,
        ListMcpCallLogResolver,
        SetMcpToolGrantResolver,
        RegisterMcpConnectorResolver,
        SyncMcpConnectorResolver,
    ],
})
/** The GraphQL transport of the MCP gateway console. */
export class McpGatewayGraphqlModule extends ConfigurableModuleClass {}

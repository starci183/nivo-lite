import { Module } from "@nestjs/common"
import { ListMcpConnectorsHandler } from "./application/list-mcp-connectors.handler"
import { ListMcpToolGrantsHandler } from "./application/list-mcp-tool-grants.handler"
import { ListMcpCallLogHandler } from "./application/list-mcp-call-log.handler"
import { SetMcpToolGrantHandler } from "./application/set-mcp-tool-grant.handler"
import { RegisterMcpConnectorHandler } from "./application/register-mcp-connector.handler"
import { SyncMcpConnectorHandler } from "./application/sync-mcp-connector.handler"
import { ApproveMcpConnectorHandler } from "./application/approve-mcp-connector.handler"
import { CheckMcpConnectorHandler } from "./application/check-mcp-connector.handler"
import { SetMcpConnectorCredentialHandler } from "./application/set-mcp-connector-credential.handler"
import { ConfigurableModuleClass } from "./mcp-gateway.module-definition"

@Module({
    providers: [
        ListMcpConnectorsHandler,
        ListMcpToolGrantsHandler,
        ListMcpCallLogHandler,
        SetMcpToolGrantHandler,
        RegisterMcpConnectorHandler,
        SyncMcpConnectorHandler,
        ApproveMcpConnectorHandler,
        CheckMcpConnectorHandler,
        SetMcpConnectorCredentialHandler,
    ],
})
/** The MCP gateway console feature: connectors, grants and the audit log. */
export class McpGatewayApiModule extends ConfigurableModuleClass {}

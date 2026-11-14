import { Module, type DynamicModule } from "@nestjs/common"
import { McpServerService } from "./mcp-server.service"
import { MCP_SERVER } from "./mcp.decorators"

@Module({})
/**
 * The MCP integration over the official TypeScript SDK: the server side of the protocol the outbound endpoint (the mcp app) answers
 * with. NIVO calls no MCP server: the engine reaches its tools directly.
 */
export class McpModule {
    /** Registers the server side once in the app that serves the endpoint. */
    static register(): DynamicModule {
        return {
            module: McpModule,
            providers: [McpServerService, { provide: MCP_SERVER, useExisting: McpServerService }],
            exports: [MCP_SERVER],
        }
    }
}

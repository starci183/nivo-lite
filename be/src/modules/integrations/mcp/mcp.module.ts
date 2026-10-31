import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { McpPublicFetchClient } from "./mcp-public-fetch.client"
import { McpRemoteClient } from "./mcp-remote.client"
import { McpServerService } from "./mcp-server.service"
import { MCP_REMOTE, MCP_SERVER } from "./mcp.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./mcp.module-definition"

@Module({})
/**
 * The MCP integration over the official TypeScript SDK: the client of remote MCP servers (Streamable HTTP) the gateway's remote
 * connectors call through, and the server side of the protocol the gateway's own endpoint answers with.
 */
export class McpModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that runs the gateway. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                McpPublicFetchClient,
                McpRemoteClient,
                { provide: MCP_REMOTE, useExisting: McpRemoteClient },
                McpServerService,
                { provide: MCP_SERVER, useExisting: McpServerService },
            ],
            exports: [MCP_REMOTE, MCP_SERVER],
        }
    }
}

import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { McpRemoteClient } from "./mcp-remote.client"
import { openSdkSession } from "./mcp-sdk.factory"
import { MCP_SESSION_OPENER } from "./mcp.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./mcp.module-definition"

@Module({})
/** The client of remote MCP servers (official SDK, Streamable HTTP) the gateway's remote connectors call through. */
export class McpModule extends ConfigurableModuleClass {
    /** Registers the client once per app that runs the gateway. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                McpRemoteClient,
                { provide: MCP_SESSION_OPENER, useValue: openSdkSession },
            ],
            exports: [McpRemoteClient],
        }
    }
}

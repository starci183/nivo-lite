import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { mcpModules } from "./compose/modules"
import type { McpAppOptions } from "./mcp.options"

@Module({})
/**
 * The composition root of the NIVO MCP gateway app: one MCP endpoint (Streamable HTTP) per workspace in front of every connector.
 * Grants, approvals, limits, the breakers and the audit live in the gateway modules, shared with the api's chat turns.
 */
export class AppModule {
    /** Builds the app from its parsed options. */
    static register(options: McpAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [...mcpModules(options)],
        }
    }
}

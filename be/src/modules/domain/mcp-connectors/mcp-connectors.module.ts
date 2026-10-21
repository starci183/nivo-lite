import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./mcp-connectors.module-definition"
import { McpConnectorsService } from "./mcp-connectors.service"

@Module({})
/** The connectors a workspace put behind its MCP gateway: the one owner of public.mcp_connectors. */
export class McpConnectorsModule extends ConfigurableModuleClass {
    /** Registers the capability under the capability that reads and writes through it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), McpConnectorsService],
            exports: [McpConnectorsService],
        }
    }
}

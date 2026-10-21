import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./mcp-tool-grants.module-definition"
import { McpToolGrantsService } from "./mcp-tool-grants.service"

@Module({})
/** The per-agent grants of gateway tools (default deny): the one owner of public.mcp_tool_grants. */
export class McpToolGrantsModule extends ConfigurableModuleClass {
    /** Registers the capability under the capability (or the app) that reads and writes through it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), McpToolGrantsService],
            exports: [McpToolGrantsService],
        }
    }
}

import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./mcp-call-log.module-definition"
import { McpCallLogService } from "./mcp-call-log.service"

@Module({})
/** The audit of every MCP gateway call: the one owner of public.mcp_call_log. */
export class McpCallLogModule extends ConfigurableModuleClass {
    /** Registers the capability under the capability that writes through it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), McpCallLogService],
            exports: [McpCallLogService],
        }
    }
}

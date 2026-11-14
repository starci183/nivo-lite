import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./tool-call-log.module-definition"
import { ToolCallLogService } from "./tool-call-log.service"

@Module({})
/** The audit of every tools registry call: the one owner of public.mcp_call_log. */
export class ToolCallLogModule extends ConfigurableModuleClass {
    /** Registers the capability under the capability that writes through it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ToolCallLogService],
            exports: [ToolCallLogService],
        }
    }
}

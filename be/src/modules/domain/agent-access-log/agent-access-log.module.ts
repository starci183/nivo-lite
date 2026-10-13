import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-access-log.module-definition"
import { AgentAccessLogService } from "./agent-access-log.service"

@Module({})
/** The log of every change of an agent's access to a connection. */
export class AgentAccessLogModule extends ConfigurableModuleClass {
    /** Registers the capability under the capability that writes through it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AgentAccessLogService],
            exports: [AgentAccessLogService],
        }
    }
}

import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AutomationRunsService } from "./automation-runs.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./automation-runs.module-definition"

@Module({})
/** The run records of the automations: one row per trigger, executed at most once per attempt. */
export class AutomationRunsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,

            providers: [...(base.providers ?? []), AutomationRunsService],
            exports: [AutomationRunsService],
        }
    }
}

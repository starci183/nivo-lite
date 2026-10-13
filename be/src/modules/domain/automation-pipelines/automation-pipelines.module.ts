import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AutomationPipelinesService } from "./automation-pipelines.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./automation-pipelines.module-definition"

@Module({})
/** The pipelines of the automations: a template switched on, off or hidden in a workspace. */
export class AutomationPipelinesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,

            providers: [...(base.providers ?? []), AutomationPipelinesService],
            exports: [AutomationPipelinesService],
        }
    }
}

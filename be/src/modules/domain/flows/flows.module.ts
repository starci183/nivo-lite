import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { FlowsService } from "./flows.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./flows.module-definition"

@Module({})
/** The operating flow facade: authority, rules, staff and decisions, handed to the flow engine. */
export class FlowsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,

            providers: [...(base.providers ?? []), FlowsService],
            exports: [FlowsService],
        }
    }
}

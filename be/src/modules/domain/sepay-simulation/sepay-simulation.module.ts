import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./sepay-simulation.module-definition"
import { SepaySimulationService } from "./sepay-simulation.service"

@Module({})
/** The development tool that posts a realistic SePay bank webhook to a running api. */
export class SepaySimulationModule extends ConfigurableModuleClass {
    /** Registers the tool once in the cli app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), SepaySimulationService],
            exports: [SepaySimulationService],
        }
    }
}

import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsService } from "./brain-facts.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./brain-facts.module-definition"

@Module({})
/** What is true about a business: the facts agents answer from, with their source, trust and validity. */
export class BrainFactsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                BrainFactsService,
                BrainFactsReadService,
                BrainFactsMaintenanceService,
            ],
            exports: [BrainFactsService],
        }
    }
}

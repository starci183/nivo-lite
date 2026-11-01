import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./ai-usage-events.module-definition"
import { AiUsageEventsService } from "./ai-usage-events.service"
import { AiUsageOverviewService } from "./ai-usage-overview.service"
import { UsageGateService } from "./usage-gate.service"

@Module({})
/** The usage capability over the primary PostgreSQL connection: model-call metering, the monthly allowance and its owner notices. */
export class AiUsageEventsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AiUsageEventsService, AiUsageOverviewService, UsageGateService],
            exports: [AiUsageEventsService, AiUsageOverviewService, UsageGateService],
        }
    }
}

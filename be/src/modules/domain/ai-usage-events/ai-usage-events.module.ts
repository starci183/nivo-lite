import { Module, type DynamicModule } from "@nestjs/common"
import { USAGE_NOTICE_DOOR } from "./ai-usage-events.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./ai-usage-events.module-definition"
import { AiUsageEventsService } from "./ai-usage-events.service"
import { AiUsageOverviewService } from "./ai-usage-overview.service"
import { AiWorkUsageService } from "./ai-work-usage.service"
import { UsageGateService } from "./usage-gate.service"

@Module({})
/** The usage capability over the primary PostgreSQL connection: model-call metering, the monthly allowance and its owner notices. */
export class AiUsageEventsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                options.notices === undefined
                    ? { provide: USAGE_NOTICE_DOOR, useValue: null }
                    : { provide: USAGE_NOTICE_DOOR, useExisting: options.notices },
                AiUsageEventsService,
                AiUsageOverviewService,
                UsageGateService,
                AiWorkUsageService,
            ],
            exports: [USAGE_NOTICE_DOOR, AiUsageEventsService, AiUsageOverviewService, UsageGateService, AiWorkUsageService],
        }
    }
}

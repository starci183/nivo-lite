import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./content-engagement-daily.module-definition"
import { ContentEngagementDailyService } from "./content-engagement-daily.service"

@Module({})
/** The content_engagement_daily capability over primary PostgreSQL. */
export class ContentEngagementDailyModule extends ConfigurableModuleClass {
    /** Registers the owning service once at the app root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ContentEngagementDailyService],
            exports: [ContentEngagementDailyService],
        }
    }
}

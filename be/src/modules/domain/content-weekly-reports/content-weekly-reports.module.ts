import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./content-weekly-reports.module-definition"
import { ContentWeeklyReportsService } from "./content-weekly-reports.service"

@Module({})
/** The content_weekly_reports capability over primary PostgreSQL. */
export class ContentWeeklyReportsModule extends ConfigurableModuleClass {
    /** Registers the owning service once at the app root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ContentWeeklyReportsService],
            exports: [ContentWeeklyReportsService],
        }
    }
}

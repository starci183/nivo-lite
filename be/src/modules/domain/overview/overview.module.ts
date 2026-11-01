import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./overview.module-definition"
import { OverviewService } from "./overview.service"
import { OverviewFiguresService } from "./overview-figures.service"
import { OverviewReadsService } from "./overview-reads.service"

@Module({})
/** The overview capability over the primary PostgreSQL connection: the read-only figures of the executive dashboard. */
export class OverviewModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), OverviewService, OverviewReadsService, OverviewFiguresService],
            exports: [OverviewService],
        }
    }
}

import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DashboardRecordsReadService } from "./dashboard-records-read.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./workspace-dashboard.module-definition"
import { WorkspaceDashboardService } from "./workspace-dashboard.service"

@Module({})
/** The workspace dashboard capability: the owner's takings, funnel and agent performance in one read. */
export class WorkspaceDashboardModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), DashboardRecordsReadService, WorkspaceDashboardService],
            exports: [WorkspaceDashboardService],
        }
    }
}

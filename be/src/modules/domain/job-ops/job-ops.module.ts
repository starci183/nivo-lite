import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./job-ops.module-definition"
import { JobOpsConsoleService } from "./job-ops-console.service"
import { JobOpsAlertMonitorService } from "./job-ops-alert-monitor.service"
import { JobTickService } from "./job-tick.service"
import { JobOpsService } from "./job-ops.service"

@Module({})
/** The operator jobs capability over the primary PostgreSQL connection. */
export class JobOpsModule extends ConfigurableModuleClass {
    /** Registers operator access, plus an alert monitor only when the app supplies its options. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                JobOpsService,
                JobTickService,
                JobOpsConsoleService,
                ...(options.alerts === undefined ? [] : [JobOpsAlertMonitorService]),
            ],
            exports: [JobOpsService, JobOpsConsoleService, JobTickService],
        }
    }
}

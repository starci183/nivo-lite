import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./job-ops.module-definition"
import { JobOpsConsoleService } from "./job-ops-console.service"
import { JobOpsService } from "./job-ops.service"

@Module({})
/** The operator jobs capability over the primary PostgreSQL connection. */
export class JobOpsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the CLI app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), JobOpsService, JobOpsConsoleService],
            exports: [JobOpsService, JobOpsConsoleService],
        }
    }
}

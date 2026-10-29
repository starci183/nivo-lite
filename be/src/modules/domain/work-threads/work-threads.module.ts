import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./work-threads.module-definition"
import { WorkThreadsLeadsReadService } from "./work-threads-leads-read.service"
import { WorkThreadsService } from "./work-threads.service"

@Module({})
/** The work threads of a workspace, over the primary Supabase PostgreSQL connection. */
export class WorkThreadsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), WorkThreadsService, WorkThreadsLeadsReadService],
            exports: [WorkThreadsService, WorkThreadsLeadsReadService],
        }
    }
}

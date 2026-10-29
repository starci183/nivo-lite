import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./work-items.module-definition"
import { WorkItemsService } from "./work-items.service"
import { WorkItemsReadService } from "./work-items-read.service"

@Module({})
/** The work items of a workspace over the primary Supabase PostgreSQL connection. */
export class WorkItemsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), WorkItemsService, WorkItemsReadService],
            exports: [WorkItemsService, WorkItemsReadService],
        }
    }
}

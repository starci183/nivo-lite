import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./data-sync-runs.module-definition"
import { DataSyncRunsService } from "./data-sync-runs.service"

@Module({})
/** The record of every sync of a workspace's own systems, over the primary PostgreSQL connection: the only writer of public.data_sync_runs. */
export class DataSyncRunsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), DataSyncRunsService], exports: [DataSyncRunsService] }
    }
}

import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./data-records.module-definition"
import { DataRecordsService } from "./data-records.service"

@Module({})
/** The rows the owner's own systems put in the hub, over the primary Supabase PostgreSQL connection: the only writer of public.data_records. */
export class DataRecordsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), DataRecordsService], exports: [DataRecordsService] }
    }
}

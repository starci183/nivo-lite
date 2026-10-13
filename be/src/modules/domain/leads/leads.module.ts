import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./leads.module-definition"
import { LeadRecordsService } from "./lead-records.service"
import { LeadsService } from "./leads.service"
import { LeadReadService } from "./lead-read.service"

@Module({})
/** The journey of a lead over the primary Supabase PostgreSQL connection. */
export class LeadsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), LeadsService, LeadRecordsService, LeadReadService],
            exports: [LeadsService, LeadRecordsService, LeadReadService],
        }
    }
}

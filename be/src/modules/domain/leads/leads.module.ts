import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { OFFICE_ROOMS_LEADS } from "@modules/domain/office-rooms"
import { RESPONSIBILITY_LEAD_DESK } from "@modules/domain/responsibilities"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./leads.module-definition"
import { LeadDeskService } from "./lead-desk.service"
import { LeadRecordsService } from "./lead-records.service"
import { LeadsService } from "./leads.service"
import { LeadReadService } from "./lead-read.service"
import { LeadAutomationReadService } from "./lead-automation-read.service"
import { LeadGenWorkbenchService } from "./leadgen-workbench.service"

@Module({})
/** The journey of a lead over the primary Supabase PostgreSQL connection. */
export class LeadsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                LeadsService,
                LeadRecordsService,
                LeadReadService,
                LeadAutomationReadService,
                LeadDeskService,
                { provide: RESPONSIBILITY_LEAD_DESK, useExisting: LeadDeskService },
                { provide: OFFICE_ROOMS_LEADS, useExisting: LeadReadService },
                LeadGenWorkbenchService,
            ],
            exports: [
                RESPONSIBILITY_LEAD_DESK,
                OFFICE_ROOMS_LEADS,
                LeadsService,
                LeadRecordsService,
                LeadReadService,
                LeadAutomationReadService,
                LeadGenWorkbenchService,
            ],
        }
    }
}

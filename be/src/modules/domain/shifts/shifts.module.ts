import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ShiftsAlertsService } from "./shifts-alerts.service"
import { ShiftsCoverService } from "./shifts-cover.service"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsImportService } from "./shifts-import.service"
import { ShiftsMonthCloseService } from "./shifts-month-close.service"
import { ShiftsNotifyService } from "./shifts-notify.service"
import { ShiftsPerformersService } from "./shifts-performers.service"
import { ShiftsRequestsService } from "./shifts-requests.service"
import { ShiftsScheduleService } from "./shifts-schedule.service"
import { ShiftsSetupService } from "./shifts-setup.service"
import { ShiftsTextService } from "./shifts-text.service"
import { ShiftsWorkbenchService } from "./shifts-workbench.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./shifts.module-definition"

@Module({})
/** The shifts capability over the primary Supabase PostgreSQL connection: the weekly schedule, swaps and leave, and the quick import. */
export class ShiftsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ShiftsDataService,
                ShiftsTextService,
                ShiftsNotifyService,
                ShiftsCoverService,
                ShiftsScheduleService,
                ShiftsRequestsService,
                ShiftsImportService,
                ShiftsPerformersService,
                ShiftsSetupService,
                ShiftsWorkbenchService,
                ShiftsAlertsService,
                ShiftsMonthCloseService,
            ],
            exports: [
                ShiftsAlertsService,
                ShiftsScheduleService,
                ShiftsRequestsService,
                ShiftsImportService,
                ShiftsSetupService,
                ShiftsWorkbenchService,
            ],
        }
    }
}
